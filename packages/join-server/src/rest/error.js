const { ErrorMessage } = require("./ErrorMessage")

function error(logger) {
	return function(err, req, res, _next) {
		if (err !== undefined) {
			logger.error(`unknown error on request ${req}: ${err.message}: ${err.stack}`)
		}
		res.status(500)
		res.set('content-type', 'application/json')
		const errorMessage = new ErrorMessage(err.message)
		res.send(errorMessage)
	}
}
module.exports = {
	error,
}