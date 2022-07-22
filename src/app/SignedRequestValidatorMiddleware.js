const { ethers } = require('ethers')

/**
 * Validates that the signedObject is valid. Resolves with the parsed request,
 * or rejects with an error if the request is not valid.
 */
async function validate(signedObject, toleranceMillis = 5 * 60 * 1000) {
    
	if (!signedObject.signature) {
		throw new InvalidSignatureError(`The field 'signature' is missing!`)
	}
	if (!signedObject.address) {
		throw new InvalidSignatureError(`The field 'address' is missing!`)
	}
	if (!signedObject.timestamp) {
		throw new InvalidTimestampError(`The field 'timestamp' is missing!`)
	}

	// Check signature
	const recoveredAddress = ethers.utils.verifyMessage(signedObject.request + signedObject.timestamp, signedObject.signature)
	if (recoveredAddress.toLowerCase() !== signedObject.address.toLowerCase()) {
		throw new InvalidSignatureError(`Invalid signature! recoveredAddress: ${recoveredAddress}, address: ${signedObject.address}!`)
	}

	// Check timestamp
	const currentTime = new Date()
	const diff = currentTime.getTime() - new Date(signedObject.timestamp).getTime()
	if (Math.abs(diff) > toleranceMillis) {
		throw new InvalidTimestampError(`Timestamp rejected! Request: ${
			signedObject.timestamp
		}, current: ${
			currentTime.toISOString()
		}, diff (ms): ${
			diff
		}, tolerance: ${
			toleranceMillis
		}`)
	}

	return JSON.parse(signedObject.request)
}

class InvalidSignatureError extends Error {}
class InvalidTimestampError extends Error {}

module.exports = (toleranceMillis = 5 * 60 * 1000) => {
	return {
		validator: async (req) => {
			const signedObject = req.body
			req.validatedRequest = await validate(signedObject, toleranceMillis)
		},
		InvalidSignatureError,
		InvalidTimestampError,
	}
}
