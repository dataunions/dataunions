class JoinRequestService {
	constructor(logger, streamrClient, joinDataUnionFunc) {
		this.logger = logger
		this.streamrClient = streamrClient
		this.joinDataUnionFunc = joinDataUnionFunc

		// Bind member functions
		this.create = this.create.bind(this)
	}

	create(member, dataUnion) {
		return this.joinDataUnionFunc(this.streamrClient, member.toString(), dataUnion.toString())
			.then(() => {
				const result = {
					member: member.toString(),
					dataUnion: dataUnion.toString(),
				}
				return result
			})
	}
}

function joinDataUnion(streamrClient, memberAddress, dataUnionAddres) {
	return streamrClient.getDataUnion(dataUnionAddres).catch((err) => {
		throw new Error(`Error while retrieving data union: ${err.message}`)
	}).then((du) => du.addMembers([memberAddress]).catch((err) => {
		throw new Error(`Error while adding a member to data union: ${err.message}`)
	}))
}

module.exports = {
	JoinRequestService,
	joinDataUnion,
}