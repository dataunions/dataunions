module.exports = (client, db) => {
	return (expressApp) => {

		// Owner authenticator middleware for the secrets management routes
		expressApp.use('/secrets/', async (req, res, next) => {
			const dataUnion = await client.getDataUnion(req.validatedRequest.dataUnion)
			if (!dataUnion) {
				res.status(404)
				res.set('content-type', 'application/json')
				res.send({
					error: `Data Union ${req.validatedRequest.dataUnion} on chain ${req.validatedRequest.chain} does not exist!`
				})
			} else {
				const owner = await dataUnion.getOwner()
				if (owner.toLowerCase() === req.body.address.toLowerCase()) {
					next()
				} else {
					res.status(403)
					res.set('content-type', 'application/json')
					res.send({
						error: `This endpoint can only be called by the Data Union owner (${owner})`
					})
				}
			}
		})

		expressApp.post('/secrets/list', async (req, res) => {
			// Get secrets from DB
			const secrets = await db.listSecrets(req.validatedRequest.dataUnion, req.validatedRequest.chain)

			res.status(200)
			res.set('content-type', 'application/json')
			res.send(secrets)
		})

		expressApp.post('/secrets/create', async (req, res) => {
			// Insert new secret to DB
			const secret = await db.createAppSecret(req.validatedRequest.dataUnion, req.validatedRequest.chain, req.validatedRequest.name)

			res.status(200)
			res.set('content-type', 'application/json')
			res.send(secret)
		})

		expressApp.delete('/secrets/delete', async (req, res) => {
			const secret = await db.getAppSecret(req.validatedRequest.secret)

			if (secret) {
				// Delete secret
				await db.deleteAppSecret(secret.secret)

				res.status(200)
				res.set('content-type', 'application/json')
				res.send(secret)
			} else {
				res.status(404)
				res.set('content-type', 'application/json')
				res.send({
					error: 'Secret not found'
				})
			}
		})
	}
}