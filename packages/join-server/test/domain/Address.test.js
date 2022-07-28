const { assert } = require('chai')
const domain = require('../../src/domain')

describe('Address', () => {
	it('throws on undefined value', () => {
		try {
			new domain.Address(undefined)
			assert.fail('expected create etherem address to fail with error')
		} catch (e) {
			if (!(e instanceof domain.InvalidEthereumAddressError)) {
				assert.fail('error is not an instance of domain.InvalidEthereumAddressError')
			}
			assert.isTrue(true)
		}
	})
	it('throws if given value is not a string', () => {
		try {
			new domain.Address({})
			assert.fail('expected create etherem address to fail with error')
		} catch (e) {
			if (!(e instanceof domain.InvalidEthereumAddressError)) {
				assert.fail('error is not an instance of domain.InvalidEthereumAddressError')
			}
			assert.isTrue(true)
		}
	})
	it('throws on invalid address', () => {
		try {
			new domain.Address('0x123')
			assert.fail('expected create etherem address to fail with error')
		} catch (e) {
			if (!(e instanceof domain.InvalidEthereumAddressError)) {
				assert.fail('error is not an instance of domain.InvalidEthereumAddressError')
			}
			assert.isTrue(true)
		}
	})
	it('converts lower case values to checksum case', () => {
		const a = new domain.Address('0x8ba1f109551bd432803012645ac136ddd64dba72')
		assert.equal(a.toString(), '0x8ba1f109551bD432803012645Ac136ddd64DBA72')
	})
	it('converts valid upper case values to lower case before assign', () => {
		const a = new domain.Address('0X8BA1F109551BD432803012645AC136DDD64DBA72')
		assert.equal(a.toString(), '0x8ba1f109551bD432803012645Ac136ddd64DBA72')
	})
})
