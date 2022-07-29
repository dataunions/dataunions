/**
 * Utility Types
 */

import type { F } from 'ts-toolbelt'

export type EthereumAddress = string

/** Utility Type: make a function maybe async */
export type MaybeAsync<T extends F.Function> = T | F.Promisify<T>
