class JoinRequest {
	constructor(
		member /* Address */,
		dataUnion /* Address */,
	) {
		this.member = member
		this.dataUnion = dataUnion
	}
}

module.exports = {
	JoinRequest,
}
