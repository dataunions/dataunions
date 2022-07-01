class JoinRequestService {
	constructor(logger, dataUnionClient, joinDataUnionFunc) {
		this.logger = logger
		this.dataUnionClient = dataUnionClient
		this.joinDataUnionFunc = joinDataUnionFunc

		// Bind member functions
		this.create = this.create.bind(this)
	}

	create(member, dataUnion) {
		return this.joinDataUnionFunc(this.dataUnionClient, member.toString(), dataUnion.toString())
			.then(() => {
				const result = {
					member: member.toString(),
					dataUnion: dataUnion.toString(),
				}
				return result
			})
	}
}

function joinDataUnion(dataUnionClient, memberAddress, dataUnionAddres) {
	return dataUnionClient.getDataUnion(dataUnionAddres).catch((err) => {
		throw new Error(`Error while retrieving data union: ${err.message}`)
	}).then((du) => du.addMembers([memberAddress]).catch((err) => {
		throw new Error(`Error while adding a member to data union: ${err.message}`)
	}))
}

module.exports = {
	JoinRequestService,
	joinDataUnion,
}