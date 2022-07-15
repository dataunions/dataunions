const process = require('process')
const commander = require('commander')
const { Server } = require('../../app')
const packageJson = require('../../../package.json')
const programName = 'duj-srv'

async function main(argv) {
	const program = new commander.Command()
	program
		.name(programName)
		.description('Data Union Join Server')
		.version(packageJson.version, '-v', 'print version')
		.helpOption('-h', 'print help message')
		.addOption(new commander.Option('-p <number>', 'port number')
			.env('PORT'))
		.addOption(new commander.Option('-l <log level>', 'log level')
			.default('info', 'options are: trace, debug, info, warn, error, and fatal')
			.env('LOG_LEVEL'))
		.addOption(new commander.Option('-k <private key>', 'private key')
			.env('PRIVATE_KEY'))
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
	if (!options.k) {
		process.stderr.write(`${program.name()}: Private key is required.\n`)
		process.exit(1)
	}

	const srv = new Server({
		port: options.p,
		logLevel: options.l,
	})
	srv.services()
	srv.routes()
	srv.run()
}

main(process.argv).catch((e) => {
	process.stderr.write(`${programName}: unknown error: ${e.message}\n`)
	process.stderr.write(`${programName}: ${e.stack}\n`)
	process.exit(1)
})
