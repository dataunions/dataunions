import DataUnionClient from "./index"
import * as NamedExports from './index'
// CJS entrypoint.

const AugmentedClient = Object.assign(DataUnionClient, NamedExports)

// required to get require('@dataunions/client') instead of require('@dataunions/client').default
module.exports = AugmentedClient

export default DataUnionClient
export * from './index'
