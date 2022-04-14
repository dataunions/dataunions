class JoinRequestService {
	constructor(joinRequestDb, logger) {
		this.joinRequestDb = joinRequestDb
		this.logger = logger

		// Bind member functions
		this.create = this.create.bind(this)
	}

	create(member, dataUnion) {
		const joinRequest = this.joinRequestDb.create(member, dataUnion)
		return joinRequest
	}
}

module.exports = {
	JoinRequestService,
}