const { newUnitTestServer } = require('./newUnitTestServer')
const request = require('supertest')
const { assert } = require('chai')
const { unitTestLogger } = require('./unitTestLogger')
const { error } =  require('../../src/rest/error')

describe('Custom Routes', async () => {
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
				app.use(error(unitTestLogger))
			}
		})
	})

	after(() => {
		srv.close()
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
			const res = await request(srv.expressApp)
				.get('/hello')
				.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
				.expect(expectedStatus)
				.expect('Content-Type', 'application/json; charset=utf-8')
			assert.equal(res.body.message, 'hello')
		})
	})

	const testCases = [
		{
			name: 'Error on custom route',
			expectedErrorMessage: 'mock error message',
		},
	]
	testCases.forEach((tc) => {
		it(tc.name, async () => {
			const expectedStatus = 500
			const res = await request(srv.expressApp)
				.post('/error')
				.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
				.expect(expectedStatus)
				.expect('Content-Type', 'application/json; charset=utf-8')
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
