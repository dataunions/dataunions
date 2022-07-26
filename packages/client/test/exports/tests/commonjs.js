// checks that require works
const { Wallet } = require('@ethersproject/wallet')
const DataUnionClient = require('@dataunions/client')
const assert = require('node:assert')

assert(!!DataUnionClient.DATAUNION_CLIENT_DEFAULTS, 'DataUnionClient should have DATAUNION_CLIENT_DEFAULTS')

const client = new DataUnionClient({
    auth: Wallet.createRandom(),
})

client.getAddress().then(async () => {
    console.info('success')
    process.exit(0)
})
