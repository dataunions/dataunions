// check esm works, as native and via webpack + babel. Also see typescript.ts
import DefaultExport, * as NamedExports from '@dataunions/client'
import assert from 'node:assert'
console.info('import DefaultExport, * as NamedExports from \'@dataunions/client\':', { DefaultExport, NamedExports })

const DataUnionClient = DefaultExport

assert(!!NamedExports.ConfigTest, 'Named exports should contain ConfigTest')
assert(!!NamedExports.generateEthereumAccount, 'Named exports should contain generateEthereumAccount')

const auth = DataUnionClient.generateEthereumAccount()

const client = new DataUnionClient({
  auth,
})

client.getUserInfo().then(async () => {
  console.info('success')
  process.exit(0)
})
