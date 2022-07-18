import type { BigNumber } from '@ethersproject/bignumber'
// import Ajv, { ErrorObject } from 'ajv'
// import addFormats from 'ajv-formats'
import cloneDeep from 'lodash/cloneDeep'
import merge from 'lodash/merge'
import 'reflect-metadata'
import type { InspectOptions } from 'util'
// import CONFIG_SCHEMA from './config.schema.json'
import type { AuthConfig, EthereumConfig } from './Ethereum'
import type { EthereumAddress } from './types'

type TimeoutConfig = {
    timeout: number
    retryInterval: number
}

type TimeoutsConfig = {
    theGraph: TimeoutConfig
    httpFetch: TimeoutConfig
}

export type ConnectionConfig = {
    /** Core HTTP API calls go here */
    restUrl: string
    /** Some TheGraph instance, that indexes the streamr registries */
    theGraphUrl: string
}

export type DataUnionConfig = {
    /**
     * Threshold value set in AMB configs, smallest token amount to pass over the bridge if
     * someone else pays for the gas when transporting the withdraw tx to mainnet;
     * otherwise the client does the transport as self-service and pays the mainnet gas costs
     */
    minimumWithdrawTokenWei: BigNumber | number | string
    payForTransport: boolean
    factoryAddress: EthereumAddress
    templateAddress: EthereumAddress
    /** joinPartAgent when using EE for join part handling */
    joinPartAgentAddress: EthereumAddress
}

export type DebugConfig = {
    inspectOpts: InspectOptions
}

/**
 * @category Important
 */
export type StrictDataUnionClientConfig = {
    /** Custom human-readable debug id for client. Used in logging. Unique id will be generated regardless. */
    id?: string,
    /**
    * Authentication: identity used by this DataUnionClient instance.
    * Can contain member privateKey or (window.)ethereum
    */
    auth: AuthConfig
    dataUnion: DataUnionConfig

    /** @internal */
    _timeouts: TimeoutsConfig
    /** @internal */
    debug: DebugConfig
} & EthereumConfig & ConnectionConfig

export type DataUnionClientConfig = Partial<Omit<StrictDataUnionClientConfig, 'dataUnion' | 'debug'> & {
    dataUnion: Partial<StrictDataUnionClientConfig['dataUnion']>
    /** @internal */
    debug: Partial<StrictDataUnionClientConfig['debug']>
}>

/**
 * @category Important
 */
export const DATAUNION_CLIENT_DEFAULTS: StrictDataUnionClientConfig = {
    auth: {},

    // Streamr Core options
    restUrl: 'https://streamr.network/api/v2',
    theGraphUrl: 'https://api.thegraph.com/subgraphs/name/streamr-dev/streams',
    // storageNodeAddressDev = new StorageNode('0xde1112f631486CfC759A50196853011528bC5FA0', '')

    // Ethereum and Data Union related options
    // For ethers.js provider params, see https://docs.ethers.io/ethers.js/v5-beta/api-providers.html#provider
    network: {
        name: 'gnosis',
        chainId: 100,
        gasPriceStrategy: (estimatedGasPrice: BigNumber) => estimatedGasPrice.add('10000000000'),
        rpcs: [{
            url: 'https://rpc.xdaichain.com/',
            timeout: 120 * 1000
        }]
    },
    tokenAddress: '0x8f693ca8D21b157107184d29D398A8D082b38b76',
    dataUnion: {
        minimumWithdrawTokenWei: '1000000',
        payForTransport: true,
        factoryAddress: '0xE41439BF434F9CfBF0153f5231C205d4ae0C22e3',
        templateAddress: '0x67352e3F7dBA907aF877020aE7E9450C0029C70c',
        joinPartAgentAddress: '0xf3E5A65851C3779f468c9EcB32E6f25D9D68601a',
    },
    _timeouts: {
        theGraph: {
            timeout: 60 * 1000,
            retryInterval: 1000
        },
        httpFetch: {
            timeout: 30 * 1000,
            retryInterval: -1 // never
        }
    },
    debug: {
        inspectOpts: {
            depth: 5,
            maxStringLength: 512
        }
    }
}

export const createStrictConfig = (inputOptions: DataUnionClientConfig = {}): StrictDataUnionClientConfig => {
    validateConfig(inputOptions)
    const opts = cloneDeep(inputOptions)
    const defaults = cloneDeep(DATAUNION_CLIENT_DEFAULTS)

    const options: StrictDataUnionClientConfig = {
        ...defaults,
        ...opts,
        dataUnion: {
            ...defaults.dataUnion,
            ...opts.dataUnion
        },
        debug: merge(defaults.debug || {}, opts.debug),
    }

    options.auth = options.auth || {}

    if ('privateKey' in options.auth) {
        const { privateKey } = options.auth
        if (typeof privateKey === 'string' && !privateKey.startsWith('0x')) {
            options.auth.privateKey = `0x${options.auth!.privateKey}`
        }
    }

    return options
}

export const validateConfig = (_data: unknown): void | never => {
    // const ajv = new Ajv()
    // addFormats(ajv)
    // ajv.addFormat('ethereum-address', /^0x[a-zA-Z0-9]{40}$/)
    // ajv.addFormat('ethereum-private-key', /^(0x)?[a-zA-Z0-9]{64}$/)
    // if (!ajv.validate(CONFIG_SCHEMA, data)) {
    //     throw new Error(ajv.errors!.map((e: ErrorObject) => {
    //         let text = ajv.errorsText([e], { dataVar: '' }).trim()
    //         if (e.params.additionalProperty) {
    //             text += `: ${e.params.additionalProperty}`
    //         }
    //         return text
    //     }).join('\n'))
    // }
}

/**
 * DI Injection tokens for pieces of config.
 * tsyringe needs a concrete value to use as the injection token.
 * In the case of interfaces & types, these have no runtime value
 * so we have to introduce some token to use for their injection.
 * These symbols represent subsections of the full config.
 *
 * For example:
 * config.ethereum can be injected with a token like: @inject(ConfigInjectionToken.Ethereum)
 */
export const ConfigInjectionToken = {
    Root: Symbol('Config.Root'),
    Auth: Symbol('Config.Auth'),
    Ethereum: Symbol('Config.Ethereum'),
    Connection: Symbol('Config.Connection'),
}
