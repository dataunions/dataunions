const { ErrorMessage } = require("./ErrorMessage")
const InvalidRequestError = require('./InvalidRequestError')

function error(logger) {
	return function(err, req, res, _next) {
		let status = 500
		if (err instanceof InvalidRequestError) {
			status = 400
			logger.error(`Invalid request ${JSON.stringify(req.body)}: ${err.message}`)
		} else if (err !== undefined) {
			logger.error(`unknown error on request ${JSON.stringify(req.body)}: ${err.message}: ${err.stack}`)
		}
		res.status(status)
		res.set('content-type', 'application/json')
		const errorMessage = new ErrorMessage(err.message)
		res.send(errorMessage)
	}
}
module.exports = {
	error,
}