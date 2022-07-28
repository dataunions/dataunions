import type { BigNumber } from '@ethersproject/bignumber'
import type { Overrides } from '@ethersproject/contracts'
import type { ExternalProvider } from '@ethersproject/providers'
import type { ConnectionInfo } from '@ethersproject/web'
import type { EthereumAddress } from './types'

/**
 * @category Important
 * Top-level DU client config
 */
export type DataUnionClientConfig = {
    /** Custom human-readable debug id for client. Used in logging. Unique id will be generated regardless. */
    id?: string,
    /**
    * Authentication: identity used by this DataUnionClient instance.
    * Can contain member privateKey or (window.)ethereum
    */
    auth: AuthConfig
    dataUnion: DataUnionConfig

    gasPriceStrategy?: (estimatedGasPrice: BigNumber) => BigNumber

    // makes it possible to initialize DU client to work in a specific Ethereum network defined in @streamr/config
    // see https://github.com/streamr-dev/network-contracts/blob/master/packages/config/src/networks.json
    chain: string

    /** @internal */
    // _timeouts: TimeoutsConfig

    // from Ethereum.ts:EthereumConfig
    tokenAddress?: EthereumAddress
    network?: NetworkConfigOverrides

    // ConnectionConfig
    /** Core HTTP API calls go here */
    // restUrl: string
    /** Some TheGraph instance, that indexes the streamr registries */
    // theGraphUrl: string
}

// under config.dataunion
export type DataUnionConfig = {
    /**
     * Threshold value set in AMB configs, smallest token amount to pass over the bridge if
     * someone else pays for the gas when transporting the withdraw tx to mainnet;
     * otherwise the client does the transport as self-service and pays the mainnet gas costs
     */
    minimumWithdrawTokenWei?: BigNumber | number | string

    factoryAddress: EthereumAddress
    templateAddress: EthereumAddress

    /** recipient of DU fees */
    duBeneficiaryAddress: EthereumAddress

    /** joinPartAgent when using EE for join part handling */
    joinPartAgentAddress: EthereumAddress
}

// these can override values from @streamr/config
export type NetworkConfigOverrides = {
    chainId?: number
    rpcs?: ConnectionInfo[]
    ethersOverrides?: Overrides
}

export type GasPriceStrategy = (estimatedGasPrice: BigNumber) => (BigNumber | Promise<BigNumber>)

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
    auth: { privateKey: '' }, // TODO: this isn't a great default...

    // Streamr Core options
    // restUrl: 'https://streamr.network/api/v2',
    // theGraphUrl: 'https://api.thegraph.com/subgraphs/name/streamr-dev/streams',

    // Ethereum and Data Union related overrides to what @streamr/config provides
    // For ethers.js provider params, see https://docs.ethers.io/ethers.js/v5-beta/api-providers.html#provider
    chain: 'gnosis',

    // tokenAddress: '', // get from @streamr/config
    dataUnion: {
        minimumWithdrawTokenWei: '1000000',
        factoryAddress: '0xE41439BF434F9CfBF0153f5231C205d4ae0C22e3',
        templateAddress: '0x67352e3F7dBA907aF877020aE7E9450C0029C70c',
        joinPartAgentAddress: '0xf3E5A65851C3779f468c9EcB32E6f25D9D68601a',
        duBeneficiaryAddress: '0xf3E5A65851C3779f468c9EcB32E6f25D9D68601a'  // TODO: decide what this should be
    },
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

export const gnosisDefaultGasPriceStrategy: GasPriceStrategy = (estimatedGasPrice: BigNumber) => estimatedGasPrice.add('10000000000')
