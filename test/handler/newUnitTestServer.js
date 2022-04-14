const express = require('express')
const pino = require('pino')
const service = require('../../src/service')
const { MockJoinRequestDB } = require('../service/MockJoinRequestDB')
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
			const joinRequestDb = new MockJoinRequestDB(
				undefined,
				undefined,
				logger,
			)
			srv.joinRequestService = new service.JoinRequestService(
				joinRequestDb,
				logger,
			)
		},
		...conf,
	)
	srv.routes()
	return srv
}

module.exports = {
	newUnitTestServer,
}