const { Sequelize, QueryTypes } = require('sequelize')
const { assert } = require('chai')
const DB = require('../../src/db/SecretDB')
require('dotenv').config()

// TODO: add test setup to root ci.yaml, see ./.github/workflows/ci.yaml (which should be deleted)
describe('DB', () => {

	let sequelize
	let db
	let secret

	const DATA_UNION_ADDRESS = '0x12345'
	const CHAIN = 'nonexistent'
	const SECRET_NAME = `DB.test.js-${Date.now()}`

	before(async () => {
		sequelize = new Sequelize(process.env.SECRET_DB_SCHEMA, process.env.SECRET_DB_USER, process.env.SECRET_DB_PASSWORD, {
			host: process.env.SECRET_DB_HOST,
			port: process.env.SECRET_DB_PORT,
			dialect: 'mysql',
		})

		await sequelize.query('DELETE FROM data_union_secret where name like :name', {
			replacements: {
				name: 'DB.test.js-%'
			},
			type: QueryTypes.DELETE
		})

		db = new DB(sequelize)
	})

	after(async () => {
		await sequelize.close()
	})

	// These tests must run sequentially!
	it('creates app secrets', async () => {
		secret = await db.createAppSecret(DATA_UNION_ADDRESS, CHAIN, SECRET_NAME)
		assert.equal(secret.dataUnion, DATA_UNION_ADDRESS)
		assert.equal(secret.chain, CHAIN)
		assert.equal(secret.name, SECRET_NAME)
	})

	it('gets app secrets', async () => {
		const fetchedSecret = await db.getAppSecret(secret.secret)
		assert.deepEqual(fetchedSecret, secret)
	})

	it('lists app secrets', async () => {
		const secrets = await db.listSecrets(DATA_UNION_ADDRESS, CHAIN)
		assert.deepEqual(secrets, [secret])
	})

	it('deletes app secrets', async () => {
		await db.deleteAppSecret(secret.secret)

		const fetchedSecret = await db.getAppSecret(secret.secret)
		assert.isUndefined(fetchedSecret)
	})

})
