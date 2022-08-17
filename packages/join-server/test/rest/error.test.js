const express = require('express')
const request = require('supertest')
const { assert } = require('chai')
const { unitTestLogger } = require('./unitTestLogger')
const { error } =  require('../../src/rest/error')

describe('Error handler', async () => {
	let srv

	before(() => {
		srv = express()
		srv.get('/hello', function(_req, res, _next) {
			res.status(200)
			res.set('content-type', 'application/json')
			res.send({message:'hello'})
		})
		srv.post('/error', function(_req, _res, _next) {
			throw new Error('mock error message')
		})
		srv.use(error(unitTestLogger))
	})

	after(() => {
		srv = undefined
	})

	const happyTestCases = [
		{
			name: 'Happy Test Case #01',
			data: 'message',
		},
	]
	happyTestCases.forEach((tc) => {
		it(tc.name, async () => {
			const expectedStatus = 200
			const res = await request(srv)
				.get('/hello')
				.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
				.expect(expectedStatus)
				.expect('Content-Type', 'application/json; charset=utf-8')
			assert.equal(res.body.message, 'hello')
		})
	})

	const testCases = [
		{
			name: 'error handler should catch error',
			expectedErrorMessage: 'mock error message',
		},
	]
	testCases.forEach((tc) => {
		it(tc.name, async () => {
			const expectedStatus = 500
			const res = await request(srv)
				.post('/error')
				.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
				.expect(expectedStatus)
				.expect('Content-Type', 'application/json; charset=utf-8')
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
