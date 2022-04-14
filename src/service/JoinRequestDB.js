
class JoinRequestDB {
	constructor(mongoClient, dbName, logger) {
		this.db_name = dbName
		this.collection_name = 'join_request'
		this.mongoClient = mongoClient
		this.logger = logger

		// Bind member functions
		this.create = this.create.bind(this)
	}

	create(member, dataUnion) {
		const joinRequest = {
			member: member.toString(),
			dataUnion: dataUnion.toString(),
		}
		this.mongoClient
			.db(this.db_name)
			.collection(this.collection_name)
			.insertOne(joinRequest).then(() => {
				this.logger.debug(`Create join request: ${JSON.stringify(joinRequest)}`)
			}).catch((err) => {
				this.logger.error(`Error while creating a join request: ${err.message}`)
			})
		return joinRequest
	}
}

module.exports = {
	JoinRequestDB,
}