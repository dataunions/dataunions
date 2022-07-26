class JoinRequestService {
	constructor(logger, dataUnionClient, onMemberJoin) {
		this.logger = logger
		this.dataUnionClient = dataUnionClient
		this.onMemberJoin = onMemberJoin
	}

	async create(member, dataUnion, chain) {
		let du
		try {
			du = await this.dataUnionClient.getDataUnion(dataUnion)
		} catch (err) {
			throw new DataUnionRetrievalError(`Error while retrieving data union ${dataUnion}: ${err.message}`)
		}
		
		if (await du.isMember(member)) {
			throw new DataUnionJoinError(`Member ${member} is already a member of ${dataUnion}!`)
		}

		try {
			await du.addMembers([member])
		} catch (err) {
			throw new DataUnionJoinError(`Error while adding member ${member} to data union ${dataUnion}: ${err.message}`)
		}

		try {
			await this.onMemberJoin(member, dataUnion, chain)
		} catch (err) {
			throw new DataUnionJoinError(`Error while adding member ${member} to data union ${dataUnion}: ${err.message}`)
		}

		return {
			member,
			dataUnion,
			chain: chain,
		}
	}
}

class DataUnionRetrievalError extends Error {}
class DataUnionJoinError extends Error {}

module.exports = {
	JoinRequestService,
	DataUnionRetrievalError,
	DataUnionJoinError,
}