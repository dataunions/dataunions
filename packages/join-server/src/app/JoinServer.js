const process = require('process')
const express = require('express')
const cors = require('cors')
const http = require('http')
const pino = require('pino')
const { DataUnionClient } = require('@dataunions/client')
const config = require('@streamr/config')
const rest = require('../rest')
const { JoinRequestService } = require('./JoinRequestService')

const signals = Object.freeze({
	'SIGINT': 2,
	'SIGTERM': 15,
})

class JoinServer {
	constructor({
		/**
		 * These options are primarily intended for end users
		 */

		// Hex-encoded private key for your joinPartAgent address
		privateKey = undefined,

		// HTTP port the server listens on
		port = 5555,

		// Logger (pino) level: one of 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent'.
		logLevel = 'info',

		// Used to validate custom fields in join requests. The default function does nothing.
		customJoinRequestValidator = async (/* address, joinRequest */) => {},

		// Used to add custom routes to the HTTP server. The default function does nothing.
		customRoutes = (/*expressApp*/) => {},

		// Gets called after a member is successfully joined to the Data Union smart contract. The default function does nothing.
		onMemberJoin = async (/* member, dataUnion, chain */) => {},

		/**
		 * These options are primarily intended for advanced use or passing in test mocks
		 */
		expressApp = express(),
		httpServer = undefined,  /* node http.Server */
		logger = pino({
			name: 'main',
			level: logLevel,
		}),
		signedRequestValidator = rest.SignedRequestValidator.validator,
		joinRequestService = undefined,
		clients = undefined,
	} = {}) {
		if (privateKey === undefined) {
			throw new Error(`Private key is required`)
		}
		this.expressApp = expressApp
		this.logger = logger
		this.signedRequestValidator = signedRequestValidator
		this.customJoinRequestValidator = customJoinRequestValidator

		if (!clients) {
			clients = new Map()
			const chains = config.Chains.load()
			for (const chainName in chains) {
				for (const contractName in chains[chainName].contracts) {
					if (contractName === "DataUnionFactory") {
						clients.set(chainName, this.newDataUnionClient(chains[chainName], privateKey))
					}
				}
			}
		}
		this.clients = clients

		if (!joinRequestService) {
			joinRequestService = new JoinRequestService(logger, this.clients, onMemberJoin)
		}
		this.joinRequestService = joinRequestService
		this.customRoutes = customRoutes

		if (!httpServer) {
			const httpServerOptions = {
				maxHeaderSize: 4096,
			}
			httpServer = http.createServer(httpServerOptions, expressApp)
		}
		this.httpServer = httpServer

		// Port is the HTTP TCP/IP port.
		this.port = port

		// Listen for Linux Signals
		Object.keys(signals).forEach((signal) => {
			process.on(signal, () => {
				this.httpServer.close(() => {
					this.logger.info(`HTTP server stopped by signal: ${signal}`)
					this.close()
					const invalidExitArg = 128
					const exitCode = invalidExitArg + signals[signal]
					process.exit(exitCode)
				})
			})
		})

		this.routes()
	}

	close() {
		this.joinRequestService.close()
		Object.keys(signals).forEach((signal) => {
			process.removeAllListeners(signal)
		})
		if (!this.server) {
			return
		}
		return new Promise((done, fail) => {
			this.server.close((err) => {
				if (err) {
					fail(err)
				}
				done()
			})
		})
	}

	newDataUnionClient(chain /* config.Chain */, privateKey /* string */) {
		const options = {
			auth: {
				privateKey,
			},
			network: {
				name: chain.name,
				chainId: chain.id,
				rpcs: chain.rpcEndpoints,
			}
		}
		return new DataUnionClient(options)
	}

	routes() {
		this.expressApp.use(express.json({
			limit: '1kb',
		}))
		this.expressApp.use(rest.error(this.logger))
		this.expressApp.use(cors())

		this.publicRoutes = new express.Router()
		this.authenticatedRoutes = new express.Router()

		// Unauthenticated endpoint for uptime monitoring
		this.publicRoutes.post('/ping', (req, res) => {
			res.status(200)
			res.send()
		})

		// Authenticated routes use the signedRequestValidator
		this.authenticatedRoutes.use((req, res, next) => this.signedRequestValidator(req).then(next).catch((err) => next(err)))
		this.authenticatedRoutes.post('/join', (req, res, next) => new rest.JoinHandler(this.logger, this.joinRequestService, this.customJoinRequestValidator).handle(req, res, next))
		this.customRoutes(this.expressApp, this.clients)
		
		this.expressApp.use('/', this.publicRoutes)
		this.expressApp.use(this.authenticatedRoutes)
	}

	listen() {
		const backlog = 511
		return new Promise((done, fail) => {
			this.server = this.expressApp.listen(this.port, backlog, (err) => {
				if (err) {
					fail(err)
				}
				this.logger.info(`HTTP server started on port: ${this.port}`)
				done()
			})
		})
	}
}

module.exports = {
	JoinServer,
}
