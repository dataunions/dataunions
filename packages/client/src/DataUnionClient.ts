import { config } from '@streamr/config'
import { getAddress, isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { debug } from 'debug'
import type { Overrides as EthersOverrides } from '@ethersproject/contracts'
import type { Signer } from '@ethersproject/abstract-signer'
import type { Provider } from '@ethersproject/providers'

import * as IERC677Json from '@dataunions/contracts/artifacts/contracts/IERC677.sol/IERC677.json'
import { DataUnionFactory as DataUnionFactoryJson, DataUnionTemplate as DataUnionTemplateJson } from '@dataunions/contracts'
import type { DataUnionFactory, DataUnionTemplate, IERC677 } from '@dataunions/contracts/typechain'

import { DATAUNION_CLIENT_DEFAULTS } from './Config'
import { Rest } from './Rest'
import { gasPriceStrategies } from './gasPriceStrategies'
import { DataUnion } from './DataUnion'
import type { DataUnionClientConfig } from './Config'
import type { DataUnionDeployOptions } from './DataUnion'
import type { EthereumAddress } from './EthereumAddress'
import type { GasPriceStrategy } from './gasPriceStrategies'

const log = debug('DataUnionClient')

// TODO: remove all this plugin/mixin nonsense. Fields don't seem to be mixed in successfully, maybe only functions? Anyway this is pointless.
// these are mixed in via Plugin function above
// use MethodNames to only grab methods
// TODO: delete probably the whole plugin architecture since we don't really have plugins anymore
// eslint-disable-next-line @typescript-eslint/no-empty-interface
// export interface DataUnionClient extends DataUnionAPI {}

export class DataUnionClient {

    /** @internal */
    // readonly id: string
    /** @internal */
    // readonly debug: Debugger

    readonly wallet: Signer
    readonly chainName: string

    readonly overrides: EthersOverrides
    readonly gasPriceStrategy?: GasPriceStrategy

    readonly minimumWithdrawTokenWei?: BigNumber | number | string

    readonly factoryAddress: EthereumAddress
    readonly joinPartAgentAddress: EthereumAddress
    readonly tokenAddress: EthereumAddress

    readonly restPlugin: Rest
    constructor(clientOptions: Partial<DataUnionClientConfig> = {}) {

        // this.id = 'DataUnionClient'
        // this.debug = Debug('DataUnionClient')
        if (!clientOptions.auth) { throw new Error("Must include auth in the config!") }
        const options: DataUnionClientConfig = { ...DATAUNION_CLIENT_DEFAULTS, ...clientOptions }

        // get defaults for networks from @streamr/config
        const chain = (config as any)[options.chain]

        this.chainName = options.chain
        this.overrides = options.network.ethersOverrides ?? {}
        this.minimumWithdrawTokenWei = options.dataUnion?.minimumWithdrawTokenWei
        this.gasPriceStrategy = options.gasPriceStrategy ?? gasPriceStrategies[options.chain]

        if (options.auth.ethereum) {
            // browser: we let Metamask do the signing, and also the RPC connections
            if (typeof options.auth.ethereum.request !== 'function') {
                throw new Error('invalid ethereum provider given to auth.ethereum')
            }
            const metamaskProvider = new Web3Provider(options.auth.ethereum)
            this.wallet = metamaskProvider.getSigner()

        } else if (options.auth.privateKey) {
            // node.js: we sign with the given private key, and we connect to given provider RPC URL
            const rpcUrl = options.network.rpcs?.[0] ?? chain?.rpcEndpoints?.[0]
            if (!rpcUrl) { throw new Error("Must include network.rpcs or chain in the config!") }
            const provider = new JsonRpcProvider(rpcUrl)
            this.wallet = new Wallet(options.auth.privateKey, provider)

        } else {
            throw new Error("Must include auth.ethereum or auth.privateKey in the config!")
        }

        // TODO: either tokenAddress -> defaultTokenAddress or delete completely; DUs can have different tokens
        this.tokenAddress = getAddress(options.tokenAddress ?? chain?.contracts.DATA ?? "Must include tokenAddress or chain in the config!")
        this.factoryAddress = getAddress(options.dataUnion?.factoryAddress ?? chain?.contracts.DataUnionFactory
                                            ?? "Must include dataUnion.factoryAddress or chain in the config!")
        this.joinPartAgentAddress = getAddress(options.dataUnion?.joinPartAgentAddress ?? config.ethereum.contracts["core-api"])

        this.restPlugin = new Rest(options.joinServerUrl)
    }

    async getAddress(): Promise<EthereumAddress> {
        return this.wallet.getAddress()
    }

    close(): void {
        this.wallet.provider!.removeAllListeners()
    }

    /**
     * Apply the gasPriceStrategy to the estimated gas price, if given in options.network.gasPriceStrategy
     * Ethers.js will resolve the gas price promise before sending the tx
     */
    async getOverrides(): Promise<EthersOverrides> {
        if (this.gasPriceStrategy) {
            const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = await this.gasPriceStrategy(this.wallet.provider!)

            // EIP-1559 or post-London gas price
            if (maxFeePerGas && maxPriorityFeePerGas) {
                return {
                    ...this.overrides,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                }
            }

            // "old style" gas price
            if (gasPrice) {
                return {
                    ...this.overrides,
                    gasPrice,
                }
            }
        }
        return this.overrides
    }

    /**
     * Can be used for Polygon and Gnosis too
     * @returns a randomly generated secure Ethereum wallet
     */
    static generateEthereumAccount(): { address: string, privateKey: string } {
        const wallet = Wallet.createRandom()
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
        }
    }

    async getFactory(factoryAddress: EthereumAddress = this.factoryAddress, wallet: Signer = this.wallet): Promise<DataUnionFactory> {
        if (await wallet.provider!.getCode(factoryAddress) === '0x') {
            throw new Error(`No Contract found at ${factoryAddress}, check DataUnionClient.options.dataUnion.factoryAddress!`)
        }
        return new Contract(factoryAddress, DataUnionFactoryJson.abi, wallet) as unknown as DataUnionFactory
    }

    getTemplate(templateAddress: EthereumAddress, provider: Provider | Signer = this.wallet): DataUnionTemplate {
        return new Contract(templateAddress, DataUnionTemplateJson.abi, provider) as unknown as DataUnionTemplate
    }

    // TODO decide: use DATAv2 instead of IERC677 for "default token"?
    getToken(tokenAddress: EthereumAddress = this.tokenAddress, provider: Provider | Signer = this.wallet): IERC677 {
        return new Contract(tokenAddress, IERC677Json.abi, provider) as unknown as IERC677
    }

    /**
     * Get token balance in "wei" (10^-18 parts) for given address
     * @param address to query, or this DU client's address if omitted
     */
    async getTokenBalance(address?: EthereumAddress): Promise<BigNumber> {
        const a = address ? getAddress(address) : await this.wallet.getAddress()
        return this.getToken().balanceOf(a)
    }

    /**
     * @category Important
     */
    async getDataUnion(contractAddress: EthereumAddress): Promise<DataUnion> {
        if (!isAddress(contractAddress)) {
            throw new Error(`Can't get DataUnion, invalid Ethereum address: ${contractAddress}`)
        }

        if (await this.wallet.provider!.getCode(contractAddress) === '0x') {
            throw new Error(`${contractAddress} is not an Ethereum contract!`)
        }

        // giving the wallet instead of just a provider to DataUnion wouldn't really be required for most operations (reading)
        //   but some operations (withdrawing) won't work without.
        // if this getSigner does nasty things (like Metamask popup?) then it could be replaced by separating
        //   getDataUnionReadonly for the cases where reading isn't required, OR
        //   just giving a read-only data union contract here, then .connect(wallet) in withdraw functions
        const contract = this.getTemplate(contractAddress, this.wallet)

        // memberData throws an error <=> not a data union (probably...)
        const looksLikeDataUnion = await contract.memberData("0x0000000000000000000000000000000000000000").then(() => true).catch(() => false)
        if (!looksLikeDataUnion) {
            throw new Error(`${contractAddress} is not a Data Union!`)
        }

        return new DataUnion(contract, this.restPlugin, this)
    }

    async deployDataUnionUsingToken(token: EthereumAddress, options: DataUnionDeployOptions = {}): Promise<DataUnion> {
        const {
            adminAddress = await this.wallet.getAddress(),
            joinPartAgents = [adminAddress, this.joinPartAgentAddress],
            dataUnionName = `DataUnion-${Date.now()}`, // TODO: use uuid
            adminFee = 0,
            confirmations = 1,
            gasPrice,
            metadata = {},
        } = options

        log(`Going to deploy DataUnion with name: ${dataUnionName}`)

        const tokenAddress = getAddress(token)
        const ownerAddress = getAddress(adminAddress)
        const agentAddressList = joinPartAgents.map(getAddress)

        if (adminFee < 0 || adminFee > 1) { throw new Error('DataUnionDeployOptions.adminFee must be a number between 0...1, got: ' + adminFee) }
        const adminFeeBN = BigNumber.from((adminFee * 1e18).toFixed()) // last 2...3 decimals are going to be gibberish, but that's not much value

        const ethersOverrides = await this.getOverrides()
        if (gasPrice) { ethersOverrides.gasPrice = gasPrice }

        // function deployNewDataUnionUsingToken(
        //     address token,
        //     address payable owner,
        //     address[] memory agents,
        //     uint256 initialAdminFeeFraction
        // )
        const duFactory = await this.getFactory()
        const tx = await duFactory.deployNewDataUnionUsingToken(
            tokenAddress,
            ownerAddress,
            agentAddressList,
            adminFeeBN,
            JSON.stringify(metadata),
            ethersOverrides
        )
        const receipt = await tx.wait(confirmations)

        const createdEvent = receipt.events?.find((e) => e.event === 'DUCreated')
        if (createdEvent == null) {
            throw new Error('Factory did not emit a DUCreated event!')
        }

        const contractAddress = createdEvent.args!.du as string
        log(`DataUnion deployed ${contractAddress}`)

        const contract = this.getTemplate(contractAddress, this.wallet)
        return new DataUnion(contract, this.restPlugin, this)
    }

    /**
     * Create a new DataUnionTemplate contract to mainnet with DataUnionFactory
     * This triggers DataUnionSidechain contract creation in sidechain, over the bridge (AMB)
     * @return Promise<DataUnion> that resolves when the new DU is deployed over the bridge to side-chain
     */
    async deployDataUnion(options: DataUnionDeployOptions = {}): Promise<DataUnion> {
        const {
            adminAddress = await this.wallet.getAddress(),
            joinPartAgents = [adminAddress, this.joinPartAgentAddress],
            dataUnionName = `DataUnion-${Date.now()}`, // TODO: use uuid
            adminFee = 0,
            confirmations = 1,
            gasPrice,
            metadata = {},
        } = options

        log(`Going to deploy DataUnion with name: ${dataUnionName}`)

        const ownerAddress = getAddress(adminAddress)
        const agentAddressList = joinPartAgents.map(getAddress)

        if (adminFee < 0 || adminFee > 1) { throw new Error('DataUnionDeployOptions.adminFee must be a number between 0...1, got: ' + adminFee) }
        const adminFeeBN = BigNumber.from((adminFee * 1e18).toFixed()) // last 2...3 decimals are going to be gibberish, but that's not much value

        const ethersOverrides = await this.getOverrides()
        if (gasPrice) { ethersOverrides.gasPrice = gasPrice }

        // function deployNewDataUnion(
        //     address payable owner,
        //     uint256 adminFeeFraction,
        //     address[] memory agents
        // )
        const duFactory = await this.getFactory()
        const tx = await duFactory.deployNewDataUnion(
            ownerAddress,
            adminFeeBN,
            agentAddressList,
            JSON.stringify(metadata),
            ethersOverrides
        )
        const receipt = await tx.wait(confirmations)

        const createdEvent = receipt.events?.find((e) => e.event === 'DUCreated')
        if (createdEvent == null) {
            throw new Error('Factory did not emit a DUCreated event!')
        }

        const contractAddress = createdEvent.args!.du as string
        log(`DataUnion deployed ${contractAddress}`)

        const contract = this.getTemplate(contractAddress, this.wallet)
        return new DataUnion(contract, this.restPlugin, this)
    }
}
