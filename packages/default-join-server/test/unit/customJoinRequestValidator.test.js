const chai = require('chai')
const { expect } = chai
chai.use(require('chai-as-promised'))

const sinon = require('sinon')
const { InvalidRequestError } = require('@dataunions/join-server')
const createCustomJoinRequestValidator = require('../../src/CustomJoinRequestValidator')

describe('customJoinRequestValidator', async () => {

	let db
	let customJoinRequestValidator

	beforeEach(() => {
		db = {
			getAppSecret: sinon.spy(async (secret) => {
				if (secret === 'test-secret') {
					return {
						secret: 'test-secret',
						dataUnion: '0xabcdef',
						chain: 'test-chain',
						name: 'This is a test secret',
					}
				}
			})
		}

		customJoinRequestValidator = createCustomJoinRequestValidator(db)
	})

	afterEach(() => {
		
	})

	it('succeeds if the secret is correct', async () => {
		await expect(customJoinRequestValidator('0x12345', {
			dataUnion: '0xABCDEF',
			chain: 'test-chain',
			secret: 'test-secret',
		})).to.be.fulfilled
		expect(db.getAppSecret.calledOnce).to.be.true
	})

	it('fails if the secret is not provided', async () => {
		await expect(customJoinRequestValidator('0x12345', {
			dataUnion: '0xABCDEF',
			chain: 'test-chain',
		})).to.be.rejectedWith(InvalidRequestError)
		expect(db.getAppSecret.calledOnce).to.be.false
	})

	it('fails if the secret is not found', async () => {
		await expect(customJoinRequestValidator('0x12345', {
			dataUnion: '0xABCDEF',
			chain: 'test-chain',
			secret: 'nonexistent',
		})).to.be.rejectedWith(InvalidRequestError)
		expect(db.getAppSecret.calledOnce).to.be.true
	})

	it('fails if the contract address does not match', async () => {
		await expect(customJoinRequestValidator('0x12345', {
			dataUnion: '0x12345',
			chain: 'test-chain',
			secret: 'test-secret',
		})).to.be.rejectedWith(InvalidRequestError)
		expect(db.getAppSecret.calledOnce).to.be.true
	})

	it('fails if the chain does not match', async () => {
		await expect(customJoinRequestValidator('0x12345', {
			dataUnion: '0xABCDEF',
			chain: 'wrong-chain',
			secret: 'test-secret',
		})).to.be.rejectedWith(InvalidRequestError)
		expect(db.getAppSecret.calledOnce).to.be.true
	})

})
