const { assert } = require('chai')
const pino = require('pino')
const { JoinRequestService } = require('../../src/service/JoinRequestService')
const { MockJoinRequestDB } = require('./MockJoinRequestDB')
const domain = require('../../src/domain')

describe('Join Request Service', () => {
	const MEMBER_ADDRESS = '0x0123456789012345678901234567890123456789'
	const DATAUNION_ADDRESS = '0x1234567890123456789012345678901234567890'
	let joinRequestService

	before(() => {
		const logger = pino({
			name: 'main',
			level: 'info',
		})
		const joinRequestDb = new MockJoinRequestDB(
			undefined,
			undefined,
			logger,
		)
		joinRequestService = new JoinRequestService(
			joinRequestDb,
			logger,
		)
	})

	after(() => {
		joinRequestService = undefined
	})

	it('create', () => {
		const member = new domain.Address(MEMBER_ADDRESS)
		const dataUnion = new domain.Address(DATAUNION_ADDRESS)
		const joinRequest = joinRequestService.create(member, dataUnion)
		assert.isNotNull(joinRequest)
	})
})
