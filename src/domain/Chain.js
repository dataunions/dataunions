const config = require('@streamr/config')

class Chain {
	constructor(name /* string */) {
		if (name === undefined) {
			throw new Error('Chain name is required')
		}
		if (typeof name !== 'string') {
			throw new Error('Chain name must be a string')
		}
		this.name = name
	}

	toString() {
		return this.name
	}

	static fromName(name) /* Chain */{
		if (name === undefined) {
			throw new Error(`Chain name is required`)
		}
		if (typeof name !== 'string') {
			throw new Error(`Chain name must be a string`)
		}
		const chains = config.Chains.load()
		const chain = chains[name.toLowerCase()]
		if (chain === undefined) {
			throw new Error(`Chain name is unknown: '${name}'`)
		}
		return new Chain(chain.toString())
	}
}

module.exports = {
	Chain,
}
