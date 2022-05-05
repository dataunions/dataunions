// ESM EntryPoint
import DataUnionClient from './index.js'
export * from './index.js'
// required to get import DataUnionClient from './DataUnionClient' to work
export default DataUnionClient.default
// note this file is manually copied as-is into dist/src since we don't want tsc to compile it to commonjs
