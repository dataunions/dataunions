const process = require('process')
const express = require('express')
const handler = require('../handler')
const domain = require('../domain')
const service = require('../service')

class Server {
	constructor(
		app /* express Application */,
		router /* express Router */,
		httpServer /* node http.Server */,
		port /* string */,
		...configOptions /* (srv: app.Server): void => {} */
	) {
		this.app = app
		this.router = router
		this.httpServer = httpServer
		this.port = port

		// Bind member functions
		this.services = this.services.bind(this)
		this.routes = this.routes.bind(this)
		this.run = this.run.bind(this)
		this.sendJsonResponse = this.sendJsonResponse.bind(this)
		this.sendJsonError = this.sendJsonError.bind(this)
		this.joinRequest = this.joinRequest.bind(this)

		this.app.use(this.router)
		configOptions.forEach((option) => {
			option(this)
		})

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
			this.dataUnionClient,
			service.joinDataUnion
		)
	}

	routes() {
		this.app.use(handler.error(this.logger))
		this.app.use(express.json({
			limit: '1kb',
		}))
		this.app.post('/api/join', this.joinRequest)
	}

	run() {
		const backlog = 511
		const callback = () => {
			this.logger.info(`HTTP server started on port: ${this.port}`)
		}
		this.app.listen(this.port, backlog, callback)
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

	joinRequest(req, res, _next) {
		let member
		try {
			member = new domain.Address(req.body.member)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid member address: '${err.address}'`)
			return
		}
	
		let dataUnion
		try {
			dataUnion = new domain.Address(req.body.dataUnion)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid Data Union contract address: '${err.address}'`)
			return
		}
		this.joinRequestService.create(member, dataUnion).then((joinRequest) => {
			// Convert app internal representation to JSON
			const joinRequestJsonResponse = {
				member: joinRequest.member.toString(),
				dataUnion: joinRequest.dataUnion.toString(),
			}
			this.logger.info(joinRequest)
			this.sendJsonResponse(res, 201, joinRequestJsonResponse)
		}).catch((err) => {
			this.logger.info(err)
			this.sendJsonError(res, 400, err.message)
		})
	}

}

module.exports = {
	Server,
}
