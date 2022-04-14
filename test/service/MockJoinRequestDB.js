const service = require('../../src/service')

class MockJoinRequestDB extends service.JoinRequestDB {
	create(member, dataUnion) {
		return {
			_id: `generated-mock-id-${Date.now()}`,
			member: member.toString(),
			dataUnion: dataUnion.toString(),
		}
	}
}

module.exports = {
	MockJoinRequestDB,
}