const { newUnitTestServer } = require('./newUnitTestServer')
const request = require('supertest')
const { assert } = require('chai')

describe('Error handler', async () => {
	let srv

	before(() => {
		srv = newUnitTestServer({
			signedRequestValidator: async (req) => {
				req.validatedRequest = {}
			},
			customRoutes: (app) => {
				app.get('/hello', function(_req, res, _next) {
					res.status(200)
					res.set('content-type', 'application/json')
					res.send({message:'hello'})
				})
				app.post('/error', function(_req, _res, _next) {
					throw new Error('mock error message')
				})
			}
		})
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
			const res = await request(srv.expressApp)
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
			const res = await request(srv.expressApp)
				.post('/error')
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(500)
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
