const { newUnitTestServer } = require('../rest/newUnitTestServer')
const { unitTestLogger } = require('../rest/unitTestLogger')
const request = require('supertest')
const { assert } = require('chai')
const sinon = require('sinon')
const app = require('../../src/app')
const InvalidRequestError = require('../../src/rest/InvalidRequestError')

describe('JoinServer', async () => {
	let srv
	let joinRequestService
	let signedRequestValidator
	let customJoinRequestValidator
	let customRoutes

	beforeEach(() => {
		// JoinRequestService with mocked create()
		joinRequestService = new app.JoinRequestService(
			unitTestLogger,
			new Map(), // clients
			function(_member, _dataUnion, _chain) {}, // onMemberJoin
		)
		joinRequestService.create = sinon.spy((member, dataUnion, chain) => {
			return {
				member,
				dataUnion,
				chain,
			}
		})

		signedRequestValidator = sinon.spy(async (req) => {
			req.validatedRequest = JSON.parse(req.body.request)
		})

		customJoinRequestValidator = sinon.stub().resolves(true),

		customRoutes = () => {}

		createServer()
	})

	function createServer() {
		srv = newUnitTestServer({
			logger: unitTestLogger,
			joinRequestService,
			signedRequestValidator,
			customJoinRequestValidator,
			customRoutes,
		})
	}

	afterEach(() => {
		srv.close()
		srv = undefined
	})

	it('fails the join request if the custom validator rejects', async () => {
		customJoinRequestValidator = sinon.stub().rejects()
		createServer()

		const expectedStatus = 400
		await request(srv.expressApp)
			.post(`/join`)
			.set('Content-Type', 'application/json')
			.send({
				address: '0x766760C748bcEcf5876a6469a6aed3C642CdA261',
				request: JSON.stringify({
					dataUnion: '0x81ed645D344cB2096aBA56B94d336E6dcF80f6C6',
					chain: 'polygon',
				}),
			})
			.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
			.expect(expectedStatus)
			.expect('Content-Type', 'application/json; charset=utf-8')
	})

	it('renders an error if the validator middleware rejects', async () => {
		const expectedStatus = 400
		signedRequestValidator = () => { throw new InvalidRequestError('test error') }
		createServer()

		await request(srv.expressApp)
			.post(`/join`)
			.set('Content-Type', 'application/json')
			.send({})
			.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
			.expect(expectedStatus)
			.expect('Content-Type', 'application/json; charset=utf-8')
	})

	it('responds to /ping', async () => {
		const expectedStatus = 200
		await request(srv.expressApp)
			.get(`/ping`)
			.send()
			.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
			.expect(expectedStatus)

		assert(signedRequestValidator.notCalled)
	})

	it('adds customRoutes upon constructions', () => {
		customRoutes = sinon.stub()
		createServer()

		assert(customRoutes.calledOnceWithExactly(srv.authenticatedRoutes, srv.clients))
	})

	it('authenticates requests to custom routes', async () => {
		customRoutes = sinon.spy((app) => {
			app.get('/hello', function(_req, res, _next) {
				res.status(200)
				res.set('content-type', 'application/json')
				res.send({message:'hello'})
			})
		})
		signedRequestValidator = sinon.stub().resolves()
		createServer()

		const expectedStatus = 200
		await request(srv.expressApp)
			.get(`/hello`)
			.expect((res) => (res.status != expectedStatus ? console.error(res.body) : true)) // print debug info if something went wrong
			.expect(expectedStatus)

		assert(signedRequestValidator.calledOnce)
		assert(customRoutes.calledOnceWithExactly(srv.authenticatedRoutes, srv.clients))
	})

	describe('constructor', () => {
		const testCases = [
			{
				name: 'private key is required',
				args: {
					privateKey: undefined,
				},
				expectedErrorMessage: 'Private key is required',
			},
		]
		testCases.forEach((tc) => {
			it(tc.name, async () => {
				try {
					new app.JoinServer({
						privateKey: tc.args.privateKey
					})
					assert.fail('expecting error message')
				} catch (err) {
					if (err.message !== tc.expectedErrorMessage) {
						assert.fail(`expecting error message: '${tc.expectedErrorMessage}', got: '${err.message}'`)
					}
					assert.isTrue(true)
				}
			})
		})
	})

})
