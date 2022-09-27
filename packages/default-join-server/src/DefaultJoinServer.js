const { Sequelize } = require('sequelize')
const { JoinServer } = require('@dataunions/join-server')
require('dotenv').config()

const SecretsDB = require('./db/SecretDB')
const StreamrDB = require('./db/StreamrDB')

const createCustomJoinRequestValidator = require('./CustomJoinRequestValidator')
const createCustomRoutes = require('./CustomRoutes')
const createOnMemberJoin = require("./OnMemberJoin")

module.exports = class DefaultJoinServer {

	constructor(dataUnionClientOptions) {
		this.dataUnionClientOptions = dataUnionClientOptions
	}

	async start() {
		const sequelizeForSecrets = new Sequelize(process.env.SECRET_DB_SCHEMA, process.env.SECRET_DB_USER, process.env.SECRET_DB_PASSWORD, {
			host: process.env.SECRET_DB_HOST,
			port: process.env.SECRET_DB_PORT,
			dialect: 'mysql',
		})

		const sequelizeForStreamr = new Sequelize(process.env.STREAMR_DB_SCHEMA, process.env.STREAMR_DB_USER, process.env.STREAMR_DB_PASSWORD, {
			host: process.env.STREAMR_DB_HOST,
			port: process.env.STREAMR_DB_PORT,
			dialect: 'mysql',
		})

		const secretsDB = new SecretsDB(sequelizeForSecrets)
		const streamrDB = new StreamrDB(sequelizeForStreamr)

		try {
			await sequelizeForSecrets.authenticate()
			console.log('Secrets database connection established successfully.')
		} catch (error) {
			console.error('Unable to connect to the database:', error)
			process.exit(1)
		}

		try {
			await sequelizeForStreamr.authenticate()
			console.log('Streamr database connection established successfully.')
		} catch (error) {
			console.error('Unable to connect to the database:', error)
			process.exit(1)
		}

		const srv = new JoinServer({
			privateKey: process.env.PRIVATE_KEY,
			customJoinRequestValidator: createCustomJoinRequestValidator(secretsDB),
			customRoutes: createCustomRoutes(secretsDB),
			onMemberJoin: createOnMemberJoin(streamrDB, process.env.PRIVATE_KEY),
		})
		srv.listen()
	}

}
