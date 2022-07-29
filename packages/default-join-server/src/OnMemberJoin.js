const StreamrClient = require('streamr-client')

module.exports = (
	streamrDB,
	privateKey, 
	streamrClient = new StreamrClient({
		auth: {
			privateKey,
		}
	}),
) => {
	return async (member, dataUnion, chain) => {
		// Find Streamr streams belonging to this dataUnion
		const streams = await streamrDB.getStreamsForDataUnion(dataUnion, chain)

		// Check that I have grant permission on the streams
		const myAddress = await streamrClient.getAddress()
		for (let i=0; i<streams.length; i++) {
			const stream = await streamrClient.getStream(streams[i])
			const iHaveGrantPermission = await stream.hasPermission({
				permission: StreamrClient.StreamPermission.PUBLISH,
				user: myAddress,
				allowPublic: false,
			})
			if (!iHaveGrantPermission) {
				throw new Error(`I don't have GRANT permission to stream ${streams[i]} or the stream doesn't exist!`)
			}
		}

		// Grant publish permission to streams in those product(s)
		if (streams.length) {
			await streamrClient.setPermissions(streams.map((streamId) => {
				return {
					streamId,
					assignments: [
						{
							user: member,
							permissions: [StreamrClient.StreamPermission.PUBLISH]
						}
					]
				}
			}))
		}
	}
}