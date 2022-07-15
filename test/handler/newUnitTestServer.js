const pino = require('pino')
const app = require('../../src/app')

const logger = pino({
	name: 'unit-test',
	level: 'trace',
	enabled: false,
})

function newUnitTestServer(...conf) {
	const srv = new app.Server({
		dataUnionClient: null,
		port: process.env.PORT,
		logger,
		...conf,
	})
	srv.routes()
	return srv
}

module.exports = {
	newUnitTestServer,
	logger,
}
