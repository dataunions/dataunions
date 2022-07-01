const { assert } = require('chai')
const pino = require('pino')
const { JoinRequestService } = require('../../src/service/JoinRequestService')
const domain = require('../../src/domain')

describe('Join Request Service', () => {
	const MEMBER_ADDRESS = '0x0123456789012345678901234567890123456789'
	const DATAUNION_ADDRESS = '0x1234567890123456789012345678901234567890'
	let joinRequestService
	let logger

	before(() => {
		logger = pino({
			name: 'main',
			level: 'info',
		})
	})

	after(() => {
		joinRequestService = undefined
	})

	it('handler join request success', async () => {
		let isJoinDataUnionFuncCalled = false
		joinRequestService = new JoinRequestService(
			logger,
			undefined, // Data Union Client
			(_dataUnionClient, memberAddress, dataUnionAddress) => {
				isJoinDataUnionFuncCalled = true
				return Promise.resolve({
					member: memberAddress,
					dataUnion: dataUnionAddress,
				})
			}, // Join Data Union Function
		)

		const member = new domain.Address(MEMBER_ADDRESS)
		const dataUnion = new domain.Address(DATAUNION_ADDRESS)
		const response = await joinRequestService.create(member, dataUnion)
		assert.isTrue(isJoinDataUnionFuncCalled)
		assert.equal(response.member, MEMBER_ADDRESS)
		assert.equal(response.dataUnion, DATAUNION_ADDRESS)
	})

	it('handle join request error when data union is not found', async () => {
		let isJoinDataUnionFuncCalled = false
		joinRequestService = new JoinRequestService(
			logger,
			undefined, // Streamr Client
			(_dataUnionClient, _memberAddress, dataUnionAddress) => {
				isJoinDataUnionFuncCalled = true
				const msg = `Error while adding a member to data union: ${dataUnionAddress} is not a Data Union!`
				return Promise.reject(new Error(msg))
			}, // Join Data Union Function
		)

		const member = new domain.Address(MEMBER_ADDRESS)
		const dataUnion = new domain.Address(DATAUNION_ADDRESS)
		try {
			const response = await joinRequestService.create(member, dataUnion)
			console.log(response)
			assert.isTrue(isJoinDataUnionFuncCalled)
		} catch (err) {
			// Prevent Mocha from catching this expected error
		}
	})

	it('handle join request error when joining data union fails', async () => {
		let isJoinDataUnionFuncCalled = false
		joinRequestService = new JoinRequestService(
			logger,
			undefined, // Streamr Client
			(_dataUnionClient, _memberAddress, _dataUnionAddress) => {
				isJoinDataUnionFuncCalled = true
				const msg = `Error while adding a member to data union: Error while joining Data Union`
				return Promise.reject(new Error(msg))
			}, // Join Data Union Function
		)

		const member = new domain.Address(MEMBER_ADDRESS)
		const dataUnion = new domain.Address(DATAUNION_ADDRESS)
		try {
			const response = await joinRequestService.create(member, dataUnion)
			console.log(response)
			assert.isTrue(isJoinDataUnionFuncCalled)
		} catch (err) {
			// Prevent Mocha from catching this expected error
		}
	})
})
