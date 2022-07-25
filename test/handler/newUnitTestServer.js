const pino = require('pino')
const app = require('../../src/app')

const logger = pino({
	name: 'unit-test',
	level: 'trace',
	enabled: false,
})

function newUnitTestServer(conf) {
	return new app.JoinServer({
		dataUnionClient: null,
		port: process.env.PORT,
		logger,
		...conf,
	})
}

module.exports = {
	newUnitTestServer,
	logger,
}
