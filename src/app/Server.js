const process = require('process')
const express = require('express')
const http = require('http')
const pino = require('pino')

const { DataUnionClient } = require('@dataunions/client')

const handler = require('../handler')
const domain = require('../domain')
const service = require('../service')


const TOLERANCE_MILLIS = 5 * 60 * 1000 // 5 min
const SignedRequestValidator = require('./SignedRequestValidatorMiddleware')(TOLERANCE_MILLIS)

class Server {
	constructor({
		/**
		 * These options are primarily intended for end users
		 */
		privateKey,
		port = 5555,
		logLevel = 'info',
		customJoinRequestValidator = async (/* joinRequest */) => {},
		customRoutes = (/*app*/) => {},

		/**
		 * These options are primarily intended for advanced use or passing in test mocks
		 */
		expressApp = express(),
		httpServer = undefined,  /* node http.Server */
		logger = pino({
			name: 'main',
			level: logLevel,
		}),
		dataUnionClient = new DataUnionClient({
			auth: {
				privateKey,
			}
		}),
		signedRequestValidator = SignedRequestValidator.validator,
		joinRequestService = new service.JoinRequestService(logger, dataUnionClient),
	} = {}) {

		this.expressApp = expressApp
		this.logger = logger
		this.dataUnionClient = dataUnionClient
		this.signedRequestValidator = signedRequestValidator
		this.customJoinRequestValidator = customJoinRequestValidator
		this.joinRequestService = joinRequestService
		this.customRoutes = customRoutes

		if (!httpServer) {
			const httpServerOptions = {
				maxHeaderSize: 4096,
			}
			httpServer = http.createServer(httpServerOptions, expressApp)
		}
		this.httpServer = httpServer
		this.port = port

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

		this.routes()
	}

	routes() {
		this.expressApp.use(express.json({
			limit: '1kb',
		}))
		this.expressApp.use((req, res, next) => this.signedRequestValidator(req).then(next).catch((err) => next(err)))
		this.expressApp.post('/join', (req, res, next) => this.joinRequest(req, res, next))
		this.customRoutes(this.expressApp)
		this.expressApp.use(handler.error(this.logger))
	}

	start() {
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
			await this.customJoinRequestValidator(req.body.address, req.validatedRequest)
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
