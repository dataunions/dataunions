const { newUnitTestServer } = require('./newUnitTestServer')
const request = require('supertest')
const { assert } = require('chai')

describe('Error handler', async () => {
	let srv

	before(() => {
		const conf = (srv) => {
			srv.app.get('/hello', function(_req, res, _next) {
				res.status(200)
				res.set('content-type', 'application/json')
				res.send({message:'hello'})
			})
			srv.app.post('/error', function(_req, _res, _next) {
				throw new Error('mock error message')
			})
		}
		srv = newUnitTestServer(conf)
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
			const res = await request(srv.app)
				.get('/hello')
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(200)
			assert.equal(res.body.message, 'hello')
		})
	})

	const testCases = [
		{
			name: 'Test Case #01',
			expectedErrorMessage: 'mock error message',
		},
	]
	testCases.forEach((tc) => {
		it(tc.name, async () => {
			const res = await request(srv.app)
				.post('/error')
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(500)
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
