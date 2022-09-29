const chai = require('chai')
const { expect } = chai
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const rest = require('../../src/rest/')

describe('Signed request validator middleware', () => {

	let clock

	beforeEach(() => {
		clock = sinon.useFakeTimers(new Date('2022-07-01T00:00:00Z').getTime())
	})

	afterEach(() => {
		clock.restore()
	})

	it('accepts valid requests and writes req.validatedRequest', async () => {
		const request = {
			body: {
				address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				request: '{"foo":"bar"}',
				timestamp: '2022-07-01T00:00:00.000Z',
				signature: '0xefde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a02c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
			}
		}

		await rest.SignedRequestValidator(request)
		expect(request.validatedRequest).to.deep.equal(JSON.parse(request.body.request))
	})

	it('rejects requests with invalid signature', async () => {
		const request = {
			body: {
				address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				request: '{"foo":"bar"}',
				timestamp: '2022-07-01T00:00:00.000Z',
				signature: '0x0fde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a02c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
			}
		}

		await expect(rest.SignedRequestValidator(request)).to.be.rejectedWith(rest.InvalidRequestError)
	})

	it('rejects requests with tampered data', async () => {
		const request = {
			body: {
				address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				request: '{"foo":"xyz"}',
				timestamp: '2022-07-01T00:00:00.000Z',
				signature: '0xefde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a02c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
			}
		}

		await expect(rest.SignedRequestValidator(request)).to.be.rejectedWith(rest.InvalidRequestError)
	})

	it('rejects requests in the future', async () => {
		const request = {
			body: {
				address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				request: '{"foo":"bar"}',
				timestamp: '2022-07-01T00:06:00.000Z',
				signature: '0x458a8940e4b047f773f6e3cf328a71f5bebf144b0ff2d7373a34ffea239ddeb4631e9b57cbf71dc04826dce04e7e07952f95e7a7b2d1a5f9b9fdfec3ba5e93cc1b'
			}
		}

		await expect(rest.SignedRequestValidator(request)).to.be.rejectedWith(rest.InvalidRequestError)
	})

	it('rejects requests in the past', async () => {
		const request = {
			body: {
				address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
				request: '{"foo":"bar"}',
				timestamp: '2022-06-30T23:54:00.000Z',
				signature: '0xa47594596ee33fc034e69af17828c102cc546c92c8598c002f3fbbb108aabbcc5dd3a041e35ceeb15510ebd5d25401d68963bc19ff248427852b24f45d88494c1c'
			}
		}

		await expect(rest.SignedRequestValidator(request)).to.be.rejectedWith(rest.InvalidRequestError)
	})

})
