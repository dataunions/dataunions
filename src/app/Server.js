const process = require('process')
const express = require('express')
const http = require('http')
const pino = require('pino')
const DU = require('@dataunions/client')

const handler = require('../handler')
const domain = require('../domain')
const service = require('../service')


const TOLERANCE_MILLIS = 5 * 60 * 1000 // 5 min
const SignedRequestValidator = require('./SignedRequestValidatorMiddleware')(TOLERANCE_MILLIS)

class Server {
	constructor({
		expressApp = express(),
		expressRouter = express.Router(),
		httpServer = undefined,  /* node http.Server */
		port = 5555,
		logLevel = 'info',
		logger = pino({
			name: 'main',
			level: logLevel,
		}),
		privateKey,
		dataUnionClient = new DU.DataUnionClient({
			auth: {
				privateKey,
			}
		}),
		signedRequestValidator = SignedRequestValidator.validator,
		customJoinRequestValidator = async (/* joinRequest */) => {},
		joinRequestService = new service.JoinRequestService(logger, dataUnionClient),
	}) {

		this.expressApp = expressApp
		this.expressRouter = expressRouter
		this.logger = logger
		this.dataUnionClient = dataUnionClient
		this.signedRequestValidator = signedRequestValidator
		this.joinRequestService = joinRequestService
		this.customJoinRequestValidator = customJoinRequestValidator

		if (!httpServer) {
			const httpServerOptions = {
				maxHeaderSize: 4096,
			}
			httpServer = http.createServer(httpServerOptions, expressApp)
		}
		this.httpServer = httpServer
		this.port = port

		this.expressApp.use(this.expressRouter)

		// Listen for Linux Signals
		const invalidExitArg = 128
		const signals = Object.freeze({
			'SIGINT': 2,
			'SIGTERM': 15,
		})
		Object.keys(signals).forEach((signal) => {
			process.on(signal, () => {
				this.httpServer.close(() => {
					this.logger.info(`HTTP server stopped by signal: ${signal}`)
					const exitCode = invalidExitArg + signals[signal]
					process.exit(exitCode)
				})
			})
		})
	}
	
	services() {
		this.joinRequestService = new service.JoinRequestService(
			this.logger,
			this.dataUnionClient, // written in main.js
			this.customJoinRequestValidator, // written in main.js
		)
	}

	routes() {
		this.expressApp.use(handler.error(this.logger))
		this.expressApp.use(express.json({
			limit: '1kb',
		}))

		this.expressApp.use((req, res, next) => this.signedRequestValidator(req).then(next).catch((err) => next(err)))
		this.expressApp.post('/api/join', this.joinRequest)
	}

	run() {
		const backlog = 511
		const callback = () => {
			this.logger.info(`HTTP server started on port: ${this.port}`)
		}
		this.expressApp.listen(this.port, backlog, callback)
	}
	
	sendJsonResponse(res, status, response) {
		res.set('content-type', 'application/json')
		res.status(status)
		res.send(response)
	}

	sendJsonError(res, status, message) {
		const errorMessage = {
			error: {
				message: message,
			},
		}
		this.sendJsonResponse(res, status, errorMessage)
	}

	async joinRequest(req, res, _next) {
		let member
		try {
			member = new domain.Address(req.body.address)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid member address: '${err.address}'`)
			return
		}
	
		let dataUnion
		try {
			dataUnion = new domain.Address(req.validatedRequest.dataUnion)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid Data Union contract address: '${err.address}'`)
			return
		}

		try {
			await this.customJoinRequestValidator(req.body.address, req.validatedJoinRequest)
		} catch (err) {
			this.sendJsonError(res, 400, `Join request failed custom validation: '${err}'`)
			return
		}

		try {
			const joinRequest = await this.joinRequestService.create(member, dataUnion)

			// Convert app internal representation to JSON
			const joinRequestJsonResponse = {
				member: joinRequest.member.toString(),
				dataUnion: joinRequest.dataUnion.toString(),
			}
			this.logger.info(joinRequest)
			this.sendJsonResponse(res, 201, joinRequestJsonResponse)
		} catch(err) {
			this.logger.info(err)
			this.sendJsonError(res, 400, err.message)
		}
	}
}

module.exports = {
	Server,
}
