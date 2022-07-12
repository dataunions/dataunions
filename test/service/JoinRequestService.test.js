const chai = require('chai')
const { assert, expect } = chai
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const pino = require('pino')
const { JoinRequestService, InvalidSignatureError, InvalidTimestampError, DataUnionJoinError, DataUnionRetrievalError } = require('../../src/service/JoinRequestService')
const domain = require('../../src/domain')

describe('Join Request Service', () => {
	const MEMBER_ADDRESS = '0x0123456789012345678901234567890123456789'
	const DATAUNION_ADDRESS = '0x1234567890123456789012345678901234567890'

	const member = new domain.Address(MEMBER_ADDRESS)
	const dataUnion = new domain.Address(DATAUNION_ADDRESS)

	let joinRequestService
	let dataUnionClient
	let dataUnionObject
	let logger

	before(() => {
		logger = pino({
			name: 'main',
			level: 'info',
		})
	})

	beforeEach(() => {
		dataUnionObject = {
			addMembers: sinon.stub().resolves(true),
		}

		dataUnionClient = {
			getDataUnion: sinon.stub().resolves(dataUnionObject),
		}

		joinRequestService = new JoinRequestService(logger, dataUnionClient)
	})

	afterEach(() => {
		joinRequestService = undefined
	})

	it('handler join request success', async () => {
		const response = await joinRequestService.create(member, dataUnion)
		assert.isTrue(dataUnionObject.addMembers.calledWith([MEMBER_ADDRESS]))
		assert.equal(response.member, MEMBER_ADDRESS)
		assert.equal(response.dataUnion, DATAUNION_ADDRESS)
	})

	it('handle join request error when data union is not found', async () => {
		dataUnionClient.getDataUnion = sinon.stub().rejects()
		await expect(joinRequestService.create(member, dataUnion)).to.be.rejectedWith(DataUnionRetrievalError)
	})

	it('handle join request error when joining data union fails', async () => {
		dataUnionObject.addMembers = sinon.stub().rejects()
		await expect(joinRequestService.create(member, dataUnion)).to.be.rejectedWith(DataUnionJoinError)
	})

	describe('validateJoinRequest', () => {
		let clock

		beforeEach(() => {
			clock = sinon.useFakeTimers(new Date('2022-07-01T00:00:00Z').getTime())
		})

		afterEach(() => {
			clock.restore()
		})

		it('accepts valid join requests', async () => {
			const joinRequest = {
				member: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				dataUnion: DATAUNION_ADDRESS,
				additionalField: 'is not a problem',
				timestamp: '2022-07-01T00:00:00Z',
				// eslint-disable-next-line max-len
				signature: '0xaabb03e281eb87df25ecf5e8c204854c617b45b54a93de85f241736b246e810903f8f3638664739dc022af83acf444bbc445af35f92c60fbe62d7d5ce71194601c'
			}

			assert.isTrue(await joinRequestService.validateJoinRequest(joinRequest))
		})

		it('rejects join requests with invalid signature', async () => {
			const joinRequest = {
				member: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				dataUnion: DATAUNION_ADDRESS,
				additionalField: 'is not a problem',
				timestamp: '2022-07-01T00:00:00Z',
				// eslint-disable-next-line max-len
				signature: '0xbbbb03e281eb87df25ecf5e8c204854c617b45b54a93de85f241736b246e810903f8f3638664739dc022af83acf444bbc445af35f92c60fbe62d7d5ce71194601c'
			}

			await expect(joinRequestService.validateJoinRequest(joinRequest)).to.be.rejectedWith(InvalidSignatureError)
		})

		it('rejects join requests with tampered data', async () => {
			const joinRequest = {
				member: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				dataUnion: DATAUNION_ADDRESS,
				additionalField: 'has been tampered',
				timestamp: '2022-07-01T00:00:00Z',
				// eslint-disable-next-line max-len
				signature: '0xaabb03e281eb87df25ecf5e8c204854c617b45b54a93de85f241736b246e810903f8f3638664739dc022af83acf444bbc445af35f92c60fbe62d7d5ce71194601c'
			}

			await expect(joinRequestService.validateJoinRequest(joinRequest)).to.be.rejectedWith(InvalidSignatureError)
		})

		it('rejects join requests in the future', async () => {
			const joinRequest = {
				member: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				dataUnion: DATAUNION_ADDRESS,
				additionalField: 'is not a problem',
				timestamp: '2022-07-01T00:06:00Z',
				// eslint-disable-next-line max-len
				signature: '0x698a0e58b60998c2632642e04de0a9586b9d274cdb284955fb6ed7b3406560e458f586c77cff8bee2dfb1c98e667fea8e06a3eafc01f4b60e38771e4d1a73e511c'
			}

			await expect(joinRequestService.validateJoinRequest(joinRequest)).to.be.rejectedWith(InvalidTimestampError)
		})

		it('rejects join requests in the past', async () => {
			const joinRequest = {
				member: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				dataUnion: DATAUNION_ADDRESS,
				additionalField: 'is not a problem',
				timestamp: '2022-06-30T23:50:00Z',
				// eslint-disable-next-line max-len
				signature: '0x8c0fc7942cd97d41f243f199a3ae88db624475ce438c1bab630dc174c05e29925ef20a1fc66aa0ed0879927f0850511da3adb67328ced0e620b9949eebc5b3681c'
			}

			await expect(joinRequestService.validateJoinRequest(joinRequest)).to.be.rejectedWith(InvalidTimestampError)
		})
	})
})
