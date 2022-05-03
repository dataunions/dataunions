const { newUnitTestServer } = require('../handler/newUnitTestServer')
const request = require('supertest')
const { assert } = require('chai')
const service = require('../../src/service')

describe('POST /api/:dataUnionAddress/joinRequest', async () => {
	let srv

	before(() => {
		srv = newUnitTestServer((srv) => {
			srv.joinRequestService = new service.JoinRequestService(
				srv.logger,
				undefined, // Streamr Client
				(_streamrClient, memberAddress, dataUnionAddress) => {
					return Promise.resolve({
						member: memberAddress,
						dataUnion: dataUnionAddress,
					})
				}, // Join Data Union Function
			)
		})
	})

	after(() => {
		srv = undefined
	})

	const happyTestCases = [
		{
			name: 'send join data union request',
			dataUnionAddress: '0x0123456789012345678901234567890123456789',
			memberAddress: '0x0000011111000001111100000111110000011111'
		},
	]
	happyTestCases.forEach((tc) => {
		it(tc.name, async () => {
			const res = await request(srv.app)
				.post(`/api/${tc.dataUnionAddress}/joinrequest`)
				.set('Content-Type', 'application/json')
				.send({
					member: tc.memberAddress,
				})
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(201)
			assert.equal(res.body.member, tc.memberAddress)
			assert.equal(res.body.dataUnion, tc.dataUnionAddress)
		})
	})

	const testCases = [
		{
			name: 'client sends invalid member address',
			dataUnionAddress: '0x0123456789012345678901234567890123456789',
			memberAddress: '0x00000',
			expectedErrorMessage: `Invalid member address: '0x00000'`,
		},
		{
			name: 'client sends invalid data union address',
			dataUnionAddress: '0x01234',
			memberAddress: '0x0000011111000001111100000111110000011111',
			expectedErrorMessage: `Invalid Data Union contract address: '0x01234'`,
		},
	]
	testCases.forEach((tc) => {
		it(tc.name, async () => {
			const res = await request(srv.app)
				.post(`/api/${tc.dataUnionAddress}/joinrequest`)
				.set('Content-Type', 'application/json')
				.send({
					member: tc.memberAddress,
				})
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(400)
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
