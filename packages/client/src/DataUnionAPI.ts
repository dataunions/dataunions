import { getAddress, isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import type { Signer } from '@ethersproject/abstract-signer'
import type { Provider } from '@ethersproject/providers'

import * as IERC677Json from '@dataunions/contracts/artifacts/contracts/IERC677.sol/IERC677.json'
import { DataUnionFactory as DataUnionFactoryJson, DataUnionTemplate as DataUnionTemplateJson } from '@dataunions/contracts'
import type { DataUnionFactory, DataUnionTemplate, IERC677 } from '@dataunions/contracts/typechain'

import { DataUnion } from './DataUnion'
import { Debug } from './log'
import type { DataUnionDeployOptions } from './DataUnion'
import type { EthereumAddress } from './EthereumAddress'
import type { DataUnionClient } from './DataUnionClient'

const log = Debug('DataUnionAPI')

export default class DataUnionAPI {

    factoryAddress: EthereumAddress
    joinPartAgentAddress: EthereumAddress
    tokenAddress: EthereumAddress
    wallet: Signer
    client: DataUnionClient
    constructor(
        wallet: Signer,
        factoryAddress: EthereumAddress,
        joinPartAgentAddress: EthereumAddress,
        tokenAddress: EthereumAddress,
        client: DataUnionClient
    ) {
        if (!wallet.provider) { throw new Error("Please give a signer with a provider to the DataUnionAPI!") }
        this.wallet = wallet
        this.tokenAddress = tokenAddress
        this.factoryAddress = factoryAddress
        this.joinPartAgentAddress = joinPartAgentAddress
        this.client = client
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

        return new DataUnion(contract, this.client.restPlugin, this.client)
    }

    async deployDataUnionUsingToken(token: EthereumAddress, options: DataUnionDeployOptions): Promise<DataUnion> {
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

        const ethersOverrides = await this.client.getOverrides()
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
        return new DataUnion(contract, this.client.restPlugin, this.client)
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

        const ethersOverrides = await this.client.getOverrides()
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
        return new DataUnion(contract, this.client.restPlugin, this.client)
    }
}
