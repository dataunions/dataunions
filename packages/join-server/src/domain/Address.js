const { ethers } = require('ethers')
const { InvalidEthereumAddressError } = require('./InvalidEthereumAddressError')

class Address {
	constructor(value /* string */) {
		if (value === undefined) {
			throw new InvalidEthereumAddressError('Given Ethereum address was undefined.')
		}
		if (typeof value !== 'string') {
			throw new InvalidEthereumAddressError(`Expecting a string type.`)
		}
		value = value.toLowerCase()
		if (!ethers.utils.isAddress(value)) {
			throw new InvalidEthereumAddressError(`Invalid Ethereum address: '${value}'`, value)
		}
		this.value = ethers.utils.getAddress(value)
	}

	static isTypeOf(address) {
		if (address === undefined) {
			return false
		}
		if (typeof address !== Address) {
			return false
		}
		return true
	}

	toString() {
		return this.value
	}
}

module.exports = {
	Address,
}
