const { assert } = require('chai')
const rest = require('../../src/rest')

describe('ErrorMessage', () => {
	it('constructor sets error message', () => {
		const expectedMessage = 'hello world'
		const msg = new rest.ErrorMessage(expectedMessage)
		assert.equal(msg.error.message, expectedMessage)
	})
})