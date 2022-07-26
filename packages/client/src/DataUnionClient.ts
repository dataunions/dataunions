import type { DataUnionClientConfig, GasPriceStrategy } from './Config'
import { DATAUNION_CLIENT_DEFAULTS } from './Config'
// import { Debug } from './utils/log'
// import type { Methods } from './utils/Plugin'
import { Plugin } from './utils/Plugin'
import DataUnionAPI from './DataUnionAPI'

import { Chains, RPCProtocol } from '@streamr/config'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { getAddress } from '@ethersproject/address'
import type { Overrides as EthersOverrides } from '@ethersproject/contracts'
import type { Signer } from '@ethersproject/abstract-signer'
import type { EthereumAddress } from './types'
import type { BigNumber } from '@ethersproject/bignumber'

// TODO: remove all this plugin/mixin nonsense. Fields don't seem to be mixed in successfully, maybe only functions? Anyway this is pointless.
// these are mixed in via Plugin function above
// use MethodNames to only grab methods
// TODO: delete probably the whole plugin architecture since we don't really have plugins anymore
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DataUnionClient extends DataUnionAPI {}

// export class DataUnionClient implements Context {
export class DataUnionClient {

    /** @internal */
    // readonly id: string
    /** @internal */
    // readonly debug: Debugger

    wallet: Signer

    overrides: EthersOverrides
    gasPriceStrategy?: GasPriceStrategy

    minimumWithdrawTokenWei?: BigNumber | number | string

    dataunionPlugin: DataUnionAPI
    constructor(clientOptions: Partial<DataUnionClientConfig> = {}) {
        // this.id = 'DataUnionClient'
        // this.debug = Debug('DataUnionClient')
        if (!clientOptions.auth) { throw new Error("Must include auth in the config!") }
        const options: DataUnionClientConfig = { ...DATAUNION_CLIENT_DEFAULTS, ...clientOptions }

        // get defaults for networks from @streamr/config
        const chains = Chains.load()
        const chain = chains[options.chain]

        this.overrides = options.network?.ethersOverrides ?? {}
        this.gasPriceStrategy = options.gasPriceStrategy
        this.minimumWithdrawTokenWei = options.dataUnion.minimumWithdrawTokenWei

        if (options.auth.ethereum) {
            // browser: we let Metamask do the signing, and also the RPC connections

            if (typeof options.auth.ethereum.request !== 'function') {
                throw new Error('invalid ethereum provider given to auth.ethereum')
            }
            const metamaskProvider = new Web3Provider(options.auth.ethereum)
            this.wallet = metamaskProvider.getSigner()

            // TODO: is this really needed? Doesn't simple `await wallet.getAddress()` work?
            // this._getAddress = async () => {
            //     try {
            //         const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
            //         const account = getAddress(accounts[0]) // convert to checksum case
            //         return account
            //     } catch {
            //         throw new Error('no addresses connected+selected in Metamask')
            //     }
            // }

            // TODO: handle events
            // ethereum.on('accountsChanged', (accounts) => { })
            // https://docs.metamask.io/guide/ethereum-provider.html#events says:
            //   "We recommend reloading the page unless you have a very good reason not to"
            //   Of course we can't and won't do that, but if we need something chain-dependent...
            // ethereum.on('chainChanged', (chainId) => { window.location.reload() });

        } else if (options.auth.privateKey) {
            // node.js: we sign with the given private key, and we connect to given provider RPC URL

            const rpcUrl = options.network?.rpcs?.[0] || chain?.getRPCEndpointsByProtocol(RPCProtocol.HTTP)[0]
            const provider = new JsonRpcProvider(rpcUrl)
            this.wallet = new Wallet(options.auth.privateKey, provider)

        } else {
            throw new Error("Must include auth.ethereum or auth.privateKey in the config!")
        }

        // TODO: either tokenAddress -> defaultTokenAddress or delete completely; DUs can have different tokens
        const tokenAddress = getAddress(options.tokenAddress || chain?.contracts.DATA || "Must include tokenAddress or chain in the config!")
        const factoryAddress = getAddress(options.dataUnion?.factoryAddress
            || chain?.contracts.DataUnionFactory
            || "Must include dataUnion.factoryAddress or chain in the config!")
        const joinPartAgentAddress = getAddress(options.dataUnion?.joinPartAgentAddress || chains.ethereum.contracts["core-api"])

        this.dataunionPlugin = new DataUnionAPI(
            this.wallet,
            factoryAddress,
            joinPartAgentAddress,
            tokenAddress,
            this
        )
        Plugin(this, this.dataunionPlugin)
    }

    async getAddress(): Promise<EthereumAddress> {
        return this.wallet.getAddress()
    }

    /**
     * Apply the gasPriceStrategy to the estimated gas price, if given in options.network.gasPriceStrategy
     * Ethers.js will resolve the gas price promise before sending the tx
     */
    getOverrides(): EthersOverrides {
        return this.gasPriceStrategy ? {
            ...this.overrides,
            gasPrice: this.wallet.provider!.getGasPrice().then(this.gasPriceStrategy)
        } : this.overrides
    }
}

/** @internal */
// export const Dependencies = {
//     Context,
//     DataUnions,
// }
