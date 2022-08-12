const chai = require('chai')
const { assert, expect } = chai
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const { JoinRequestService, DataUnionJoinError, DataUnionRetrievalError } = require('../../src/app/JoinRequestService')
const { unitTestLogger } = require('../rest/unitTestLogger')

describe('JoinRequestService', () => {
	const MEMBER_ADDRESS = '0x0123456789012345678901234567890123456789'
	const DATAUNION_ADDRESS = '0x1234567890123456789012345678901234567890'
	const CHAIN = 'polygon'

	let joinRequestService
	let dataUnionClient
	let dataUnionObject
	let onMemberJoin

	beforeEach(() => {
		dataUnionObject = {
			isMember: sinon.stub().resolves(false),
			addMembers: sinon.stub().resolves(true),
		}

		dataUnionClient = {
			getDataUnion: sinon.stub().resolves(dataUnionObject),
		}

		const clients = new Map()
		clients.set(CHAIN, dataUnionClient)
		onMemberJoin = sinon.stub()
		joinRequestService = new JoinRequestService(unitTestLogger, clients, onMemberJoin)
	})

	afterEach(() => {
		joinRequestService = undefined
	})

	describe('create', () => {
		it('adds members using the DU client', async () => {
			const response = await joinRequestService.create(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN)
			assert.isTrue(dataUnionObject.addMembers.calledWith([MEMBER_ADDRESS]))
			assert.equal(response.member, MEMBER_ADDRESS)
			assert.equal(response.dataUnion, DATAUNION_ADDRESS)
			assert.equal(response.chain, CHAIN)
		})

		it('rejects when data union is not found', async () => {
			dataUnionClient.getDataUnion = sinon.stub().rejects()
			await expect(joinRequestService.create(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN)).to.be.rejectedWith(DataUnionRetrievalError)
		})

		it('rejects if the member is already a member', async () => {
			dataUnionObject.isMember = sinon.stub().resolves(true),
			await expect(joinRequestService.create(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN)).to.be.rejectedWith(DataUnionJoinError)
		})

		it('rejects when joining data union fails', async () => {
			dataUnionObject.addMembers = sinon.stub().rejects()
			await expect(joinRequestService.create(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN)).to.be.rejectedWith(DataUnionJoinError)
		})

		it('calls the onMemberJoin function on join', async() => {
			await joinRequestService.create(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN)
			assert.isTrue(onMemberJoin.calledWith(MEMBER_ADDRESS, DATAUNION_ADDRESS, CHAIN))
		})
	})
})
