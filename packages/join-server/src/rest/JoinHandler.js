const domain = require('../domain')
const { ErrorMessage } = require('./ErrorMessage')

class JoinHandler {
	constructor(logger, joinRequestService, customJoinRequestValidator) {
		this.logger = logger
		this.joinRequestService = joinRequestService
		this.customJoinRequestValidator = customJoinRequestValidator
	}

	sendJsonResponse(res, status, response) {
		res.set('content-type', 'application/json')
		res.status(status)
		res.send(response)
	}

	sendJsonError(res, status, message) {
		const errorMessage = new ErrorMessage(message)
		this.sendJsonResponse(res, status, errorMessage)
	}

	async handle(req, res, _next) {
		let member
		try {
			member = new domain.Address(req.body.address)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid member address: '${err.address}'`)
			return
		}

		let dataUnion
		try {
			dataUnion = new domain.Address(req.validatedRequest.dataUnion)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid Data Union contract address: '${err.address}'`)
			return
		}

		let chain
		try {
			chain = domain.Chain.fromName(req.validatedRequest.chain)
		} catch (err) {
			this.sendJsonError(res, 400, `Invalid chain name: '${req.validatedRequest.chain}'`)
			return
		}

		try {
			await this.customJoinRequestValidator(req.body.address, req.validatedRequest)
		} catch (err) {
			this.sendJsonError(res, 400, `Join request failed custom validation: '${err}'`)
			return
		}

		try {
			const joinResponse = await this.joinRequestService.create(member.toString(), dataUnion.toString(), chain.toString())
			this.logger.info(joinResponse)
			this.sendJsonResponse(res, 200, joinResponse)
		} catch (err) {
			this.logger.info(err)
			this.sendJsonError(res, 400, err.message)
		}
	}
}

module.exports = {
	JoinHandler,
}