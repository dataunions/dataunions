const process = require('process')
const http = require('http')
const express = require('express')
const commander = require('commander')
const pino = require('pino')
const app = require('../../app')
const packageJson = require('../../../package.json')
const mongodb = require('mongodb')

const programName = 'duj-srv'

async function main(argv) {
	const program = new commander.Command()
	program
		.name(programName)
		.description('Data Union Join Server')
		.version(packageJson.version, '-v', 'print version')
		.helpOption('-h', 'print help message')
		.addOption(new commander.Option('-p <number>', 'port number')
			.env('HTTP_PORT'))
		.addOption(new commander.Option('-m <mongodb uri>', 'mongo db connection uri')
			.env('MONGODB_URI'))
		.addOption(new commander.Option('-l <log level>', 'log level')
			.default('info', 'options are: trace, debug, info, warn, error, and fatal')
			.env('LOG_LEVEL'))
		.parse(argv)
	const options = program.opts()
	if (options.h) {
		program.help({
			error: true,
		})
	}
	if (options.v) {
		process.stdout.write(`${packageJson.version}\n`)
		process.exit(0)
	}
	if (options.p) {
		const min = 1
		const max = 65535
		if (options.p < min || options.p > max) {
			process.stderr.write(`${program.name()}: HTTP port range is ${min} - ${max}\n`)
			process.exit(1)
		}
	} else {
		process.stderr.write(`${program.name()}: HTTP port is required.\n`)
		process.exit(1)
	}
	if (!options.m) {
		process.stderr.write(`${program.name()}: mongodb uri is required.\n`)
		process.exit(1)
	}
	const expressApp = express()
	const expressRouter = express.Router()
	const httpServerOptions = {
		maxHeaderSize: 4096,
	}
	const httpServer = http.createServer(httpServerOptions, expressApp)
	const srv = new app.Server(
		expressApp,
		expressRouter,
		httpServer,
		options.p,
		(srv) => {
			srv.logger = pino({
				name: 'main',
				level: options.l,
			})
		},
		(srv) => {
			let mongoClient = new mongodb.MongoClient(options.m)
			mongoClient.connect().then(() => {
				// wait until connected
			}).catch((err) => {
				process.stderr.write(`${program.name()}: connection to mongodb failed with error: ${err.message}\n`)
				process.exit(1)
			})
			srv.mongoClient = mongoClient
		},
	)
	srv.services()
	srv.routes()
	srv.run()
}

main(process.argv).catch((e) => {
	process.stderr.write(`${programName}: unknown error: ${e.message}\n`)
	process.stderr.write(`${programName}: ${e.stack}\n`)
	process.exit(1)
})
