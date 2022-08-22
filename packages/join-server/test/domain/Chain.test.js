const { assert } = require('chai')
const domain = require('../../src/domain')

describe('Chain', () => {
	it('throws on undefined value', () => {
		try {
			new domain.Chain(undefined)
			assert.fail('expecting error from new Chain(undefined)')
		} catch (err) {
			assert.isTrue(true)
		}
	})
	it('throws if given value is not a string', () => {
		try {
			new domain.Chain({})
			assert.fail('expecting error from new Chain({})')
		} catch (err) {
			assert.isTrue(true)
		}
	})
	it('fromName() throws on undefined name', () => {
		try {
			domain.Chain.fromName(undefined)
			assert.fail('expecting error from Chain.from({})')
		} catch (err) {
			assert.isTrue(true)
		}
	})
	it('fromName() throws on non string argument', () => {
		try {
			domain.Chain.fromName({})
			assert.fail('expecting error from Chain.from({})')
		} catch (err) {
			assert.isTrue(true)
		}

	})
	it('fromName() loads Chain instance from given string', () => {
		assert.equal(domain.Chain.fromName('Ethereum').toString(), 'ethereum')
		assert.equal(domain.Chain.fromName('ethereum').toString(), 'ethereum')
		assert.equal(domain.Chain.fromName('Polygon').toString(), 'polygon')
	})
	it('fromName() returns undefined on unknown chain', () => {
		try {
			domain.Chain.fromName('FOOBAR')
			assert.fail('expecting error from Chain.fromName(\'FOOBAR\')')
		} catch (err) {
			assert.isTrue(true)
		}
	})
})
