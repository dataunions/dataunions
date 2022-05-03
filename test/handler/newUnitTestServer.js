const express = require('express')
const pino = require('pino')
const app = require('../../src/app')

function newUnitTestServer(...conf) {
	const srv = new app.Server(
		express(),
		express.Router(),
		undefined,
		process.env.HTTP_PORT,
		(srv) => {
			const logger = pino({
				name: 'unit-test',
				level: 'trace',
				enabled: false,
			})
			srv.logger = logger
		},
		...conf,
	)
	srv.routes()
	return srv
}

module.exports = {
	newUnitTestServer,
}