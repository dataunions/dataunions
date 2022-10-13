import type { BigNumber } from '@ethersproject/bignumber'
import type { Overrides } from '@ethersproject/contracts'
import type { ExternalProvider } from '@ethersproject/providers'
import type { ConnectionInfo } from '@ethersproject/web'
import type { EthereumAddress } from './EthereumAddress'
import type { GasPriceStrategy } from './gasPriceStrategies'

/**
 * @category Important
 * Top-level DU client config
 */
export type DataUnionClientConfig = {
    /** Custom human-readable debug id for client. Used in logging. Unique id will be generated regardless. TODO: delete probably */
    id?: string,

    joinServerUrl: string,

    /**
    * Authentication: identity used by this DataUnionClient instance.
    * Can contain member privateKey or (window.)ethereum
    */
    auth: AuthConfig

    // TODO: refactor out this, once it's okay to break compatibility
    dataUnion: Partial<DataUnionConfig>

    gasPriceStrategy?: GasPriceStrategy

    // makes it possible to initialize DU client to work in a specific Ethereum network defined in @streamr/config
    // see https://github.com/streamr-dev/network-contracts/blob/master/packages/config/src/networks.json
    chain: string

    // overrides to what @streamr/config provides via the "chain" option above
    tokenAddress?: EthereumAddress
    network: NetworkConfigOverrides

    // ConnectionConfig
    /** Core HTTP API calls go here */
    // restUrl: string
    /** Some TheGraph instance, that indexes the streamr registries */
    // theGraphUrl: string
    /** @internal */
    // _timeouts: TimeoutsConfig
}

// under config.dataUnion
export type DataUnionConfig = {
    /**
     * Threshold value set in AMB configs, smallest token amount to pass over the bridge if
     * someone else pays for the gas when transporting the withdraw tx to mainnet;
     * otherwise the client does the transport as self-service and pays the mainnet gas costs
     */
    minimumWithdrawTokenWei: BigNumber | number | string

    factoryAddress: EthereumAddress
    templateAddress: EthereumAddress

    /** joinPartAgent when using EE for join part handling */
    joinPartAgentAddress: EthereumAddress
}

// these can override values from @streamr/config
export type NetworkConfigOverrides = {
    // For ethers.js provider params, see https://docs.ethers.io/ethers.js/v5-beta/api-providers.html#provider
    ethersOverrides?: Overrides
    chainId?: number
    rpcs?: ConnectionInfo[]
}

// type TimeoutConfig = {
//     timeout: number
//     retryInterval: number
// }

// type TimeoutsConfig = {
//     theGraph: TimeoutConfig
//     httpFetch: TimeoutConfig
// }

export type ProviderAuthConfig = {
    ethereum: ExternalProvider
}

export type PrivateKeyAuthConfig = {
    privateKey: string,
}

// TODO: maybe less magic pls
export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
export type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U
export type AuthConfig = XOR<ProviderAuthConfig, PrivateKeyAuthConfig>

/**
 * @category Important
 */
export const DATAUNION_CLIENT_DEFAULTS: DataUnionClientConfig = {
    auth: { privateKey: '' }, // TODO: this isn't a great default... must check in constructor that auth info really was given

    joinServerUrl: 'https://join.dataunions.org',
    // theGraphUrl: 'https://api.thegraph.com/subgraphs/name/streamr-dev/streams', // TODO

    // Ethereum and Data Union related overrides to what @streamr/config provides
    chain: 'polygon',

    dataUnion: {
        minimumWithdrawTokenWei: '1000000',
    },

    network: {},
    // _timeouts: {
    //     theGraph: {
    //         timeout: 60 * 1000,
    //         retryInterval: 1000
    //     },
    //     httpFetch: {
    //         timeout: 30 * 1000,
    //         retryInterval: -1 // never
    //     }
    // },
    // debug: {
    //     inspectOpts: {
    //         depth: 5,
    //         maxStringLength: 512
    //     }
    // }
}
