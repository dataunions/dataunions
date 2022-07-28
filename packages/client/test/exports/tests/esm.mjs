// check esm works, as native and via webpack + babel. Also see typescript.ts
import DefaultExport, * as NamedExports from '@dataunions/client'
import assert from 'node:assert'
import { Wallet } from '@ethersproject/wallet'

console.info('import DefaultExport, * as NamedExports from \'@dataunions/client\':', { DefaultExport, NamedExports })

const DataUnionClient = DefaultExport

assert(!!NamedExports.DATAUNION_CLIENT_DEFAULTS, 'Named exports should contain DATAUNION_CLIENT_DEFAULTS')

const client = new DataUnionClient({
  auth: Wallet.createRandom(),
})

client.getAddress().then(async () => {
  console.info('success')
  process.exit(0)
})
