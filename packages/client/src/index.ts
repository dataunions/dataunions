/**
 * DataUnionClient
 *
 * @packageDocumentation
 * @module DataUnionClient
 */

import 'reflect-metadata'
import { DataUnionClient } from './DataUnionClient'

/**
 * This file captures named exports so we can manipulate them for cjs/browser builds.
 */
export { BigNumber } from '@ethersproject/bignumber'
export type { Bytes, BytesLike } from '@ethersproject/bytes'
export { Contract } from '@ethersproject/contracts'
export type { ContractReceipt, ContractTransaction } from '@ethersproject/contracts'
export type { ExternalProvider } from '@ethersproject/providers'
export type { ConnectionInfo } from '@ethersproject/web'

export { DataUnionConfig, DATAUNION_CLIENT_DEFAULTS } from './Config'
export * from './types'

export * from './DataUnionClient'

export default DataUnionClient
