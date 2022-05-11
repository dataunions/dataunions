// checks that require works
const DataUnionClient = require('@dataunions/client')
const assert = require('node:assert')

console.info('const DataUnionClient = require(\'streamr-client\'):', { DataUnionClient })
assert(!!DataUnionClient.ConfigTest, 'DataUnionClient should contain ConfigTest')
assert(!!DataUnionClient.generateEthereumAccount, 'DataUnionClient should have generateEthereumAccount')
const auth = DataUnionClient.generateEthereumAccount()
const client = new DataUnionClient({
    auth,
})
client.getUserInfo().then(async () => {
    console.info('success')
    process.exit(0)
})
