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
				return Promise.resolve(result)
			})
			.catch((err) => {
				return Promise.reject(err)
			})
	}
}

function joinDataUnion(streamrClient, memberAddress, dataUnionAddres) {
	return streamrClient.getDataUnion(dataUnionAddres).then((du) => {
		du.addMembers([memberAddress]).then((value) => {
			return Promise.resolve(value)
		}).catch((err) => {
			return Promise.reject(new Error(`Error while adding a member to data union: ${err.message}`))
		})
	}).catch((err) => {
		return Promise.reject(new Error(`Error while retrieving data union: ${err.message}`))
	})
}

module.exports = {
	JoinRequestService,
	joinDataUnion,
}