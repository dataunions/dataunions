class InvalidEthereumAddressError extends Error {
	constructor(
		message, /* string */
		address, /* string */
	) {
		super(message)
		this.address = address
	}
}

module.exports = {
	InvalidEthereumAddressError,
}
