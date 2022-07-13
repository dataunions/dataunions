const { ethers } = require('ethers')

const TOLERANCE_MILLIS = 5 * 60 * 1000 // 5 min

class JoinRequestService {
	constructor(logger, dataUnionClient) {
		this.logger = logger
		this.dataUnionClient = dataUnionClient
	}

	async create(member, dataUnion) {
		let du
		try {
			du = await this.dataUnionClient.getDataUnion(dataUnion.toString())
		} catch (err) {
			throw new DataUnionRetrievalError(`Error while retrieving data union ${dataUnion}: ${err.message}`)
		}
		
		try {
			await du.addMembers([member.toString()])
		} catch (err) {
			throw new DataUnionJoinError(`Error while adding member ${member} to data union ${dataUnion}: ${err.message}`)
		}

		return {
			member: member.toString(),
			dataUnion: dataUnion.toString(),
		}
	}

	async validateJoinRequest(signedObject) {
		const payload = getSignablePayload(signedObject)

		// Check signature
		let recoveredAddress
		try {
			recoveredAddress = ethers.utils.verifyMessage(payload, signedObject.signature)
		} catch (err) {
			throw new InvalidSignatureError(`Failed to recover address from signature: ${err}`)
		}

		if (recoveredAddress.toLowerCase() !== signedObject.member.toLowerCase()) {
			throw new InvalidSignatureError(`Invalid signature! recoveredAddress: ${recoveredAddress}, member: ${signedObject.member}!`)
		}

		// Check timestamp
		const currentTime = new Date()
		const diff = currentTime.getTime() - new Date(signedObject.timestamp).getTime()
		if (Math.abs(diff) > TOLERANCE_MILLIS) {
			throw new InvalidTimestampError(`Timestamp rejected! Request: ${
				signedObject.timestamp
			}, current: ${
				currentTime.toISOString()
			}, diff (sec): ${
				diff / 1000
			}, tolerance (sec): ${
				TOLERANCE_MILLIS / 1000
			}`)
		}

		return true
	}
}

/**
 * Sorts the keys of object into alphabetical order, and
 * creates a concatenated string of all the values.
 * The key 'signature' is ignored.
 * 
 * The method works recursively for nested objects and arrays.
 * 
 * This implementation must match the one in the DU client!
 */
function getSignablePayload(object) {
	let result = ""

	if (object == null) {
		result += 'null'
	} else if (Array.isArray(object)) {
		result += JSON.stringify(object.map((item) => getSignablePayload(item)))
	} else if (typeof object === 'object') {
		const sortedKeys = Object.keys(object).sort()
		sortedKeys.forEach((key) => {
			if (key === 'signature') {
				return
			}

			result += key
			const value = object[key]
			result += getSignablePayload(value)
		})
	} else {
		result += object
	}

	return result
}

class InvalidSignatureError extends Error {}
class InvalidTimestampError extends Error {}
class DataUnionRetrievalError extends Error {}
class DataUnionJoinError extends Error {}

module.exports = {
	JoinRequestService,
	InvalidSignatureError,
	InvalidTimestampError,
	DataUnionRetrievalError,
	DataUnionJoinError,
}