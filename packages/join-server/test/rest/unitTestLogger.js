const pino = require('pino')

const unitTestLogger = pino({
	name: 'unit-test',
	level: 'silent',
	enabled: true,
})

module.exports = {
	unitTestLogger,
}
