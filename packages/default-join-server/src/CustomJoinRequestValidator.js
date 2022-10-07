const { InvalidRequestError } = require('@dataunions/join-server')

module.exports = (db) => {
	return async (address, joinRequest) => {
		if (!joinRequest.secret) {
			throw new InvalidRequestError(`App secret not provided by ${address}`)
		}

		const secret = await db.getAppSecret(joinRequest.secret)
		if (!secret 
            || secret.dataUnion.toLowerCase() !== joinRequest.dataUnion.toLowerCase()
            || secret.chain !== joinRequest.chain) {
			throw new InvalidRequestError(`Invalid app secret provided by ${address}`)
		}
	}
}