const { newUnitTestServer } = require('../handler/newUnitTestServer')
const request = require('supertest')
const { assert } = require('chai')
const service = require('../../src/service')

describe('POST /api/join', async () => {
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
			dataUnionAddress: '0x81ed645D344cB2096aBA56B94d336E6dcF80f6C6',
			memberAddress: '0x766760C748bcEcf5876a6469a6aed3C642CdA261'
		},
	]
	happyTestCases.forEach((tc) => {
		it(tc.name, async () => {
			const res = await request(srv.app)
				.post(`/api/join`)
				.set('Content-Type', 'application/json')
				.send({
					member: tc.memberAddress,
					dataUnion: tc.dataUnionAddress,
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
			dataUnionAddress: '0x81ed645D344cB2096aBA56B94d336E6dcF80f6C6',
			memberAddress: '0x00000',
			expectedErrorMessage: `Invalid member address: '0x00000'`,
		},
		{
			name: 'client sends invalid data union address',
			dataUnionAddress: '0x01234',
			memberAddress: '0x766760C748bcEcf5876a6469a6aed3C642CdA261',
			expectedErrorMessage: `Invalid Data Union contract address: '0x01234'`,
		},
	]
	testCases.forEach((tc) => {
		it(tc.name, async () => {
			const res = await request(srv.app)
				.post(`/api/join`)
				.set('Content-Type', 'application/json')
				.send({
					member: tc.memberAddress,
					dataUnion: tc.dataUnionAddress,
				})
				.expect('Content-Type', 'application/json; charset=utf-8')
				.expect(400)
			assert.equal(res.body.error.message, tc.expectedErrorMessage)
		})
	})
})
