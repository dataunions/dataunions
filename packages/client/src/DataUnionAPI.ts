import { inject, Lifecycle, scoped } from 'tsyringe'

import type { Signer } from '@ethersproject/abstract-signer'
import type { Provider } from '@ethersproject/providers'
import { getAddress, isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { parseEther } from '@ethersproject/units'

import type { DataUnionFactory, DataUnionTemplate, IERC677 } from '@dataunions/contracts/typechain'
import * as DataUnionTemplateJson from '@dataunions/contracts/artifacts/contracts/unichain/DataUnionTemplate.sol/DataUnionTemplate.json'
import * as DataUnionFactoryJson from '@dataunions/contracts/artifacts/contracts/unichain/DataUnionFactory.sol/DataUnionFactory.json'
import * as IERC677Json from '@dataunions/contracts/artifacts/contracts/IERC677.sol/IERC677.json'

import type { StrictDataUnionClientConfig } from './Config'
import type { DataUnionDeployOptions } from './DataUnion'
import type { EthereumAddress } from './types'
import { ConfigInjectionToken } from './Config'
import { DataUnion } from './DataUnion'
import { Ethereum } from './Ethereum'
import { Rest } from './Rest'
import { Debug } from './utils/log'

const log = Debug('DataUnionAPI')

@scoped(Lifecycle.ContainerScoped)
export default class DataUnionAPI {
    token: IERC677
    factory: DataUnionFactory
    constructor(
        @inject(Ethereum) public ethereum: Ethereum,
        @inject(Rest) public rest: Rest,
        @inject(ConfigInjectionToken.Root) public options: StrictDataUnionClientConfig,
    ) {
        this.token = this.getToken()
        this.factory = this.getFactory()
    }

    getFactory(
        factoryAddress: EthereumAddress = this.options.dataUnion.factoryAddress,
        provider: Provider | Signer = this.ethereum.getProvider()
    ): DataUnionFactory {
        return new Contract(factoryAddress, DataUnionFactoryJson.abi, provider) as DataUnionFactory
    }

    getTemplate(
        templateAddress: EthereumAddress,
        provider: Provider = this.ethereum.getProvider()
    ): DataUnionTemplate {
        return new Contract(templateAddress, DataUnionTemplateJson.abi, provider) as DataUnionTemplate
    }

    getToken(
        tokenAddress: EthereumAddress = this.options.tokenAddress,
        provider: Provider = this.ethereum.getProvider()
    ): IERC677 {
        return new Contract(tokenAddress, IERC677Json.abi, provider) as IERC677
    }

    /**
     * Get token balance in "wei" (10^-18 parts) for given address
     */
    async getTokenBalance(address: EthereumAddress): Promise<BigNumber> {
        return this.token.balanceOf(getAddress(address))
    }

    /**
     * @category Important
     */
    async getDataUnion(contractAddress: EthereumAddress): Promise<DataUnion | never> {
        if (!isAddress(contractAddress)) {
            throw new Error(`Can't get DataUnion, invalid Ethereum address: ${contractAddress}`)
        }

        const provider = this.ethereum.getProvider()
        if (await provider.getCode(contractAddress) === '0x') {
            throw new Error(`No Contract found at ${contractAddress}, check DataUnionClient.options.dataUnion.factoryAddress!`)
        }

        return new DataUnion(contractAddress, this)
    }

    /**
     * Create a new DataUnionTemplate contract to mainnet with DataUnionFactory
     * This triggers DataUnionSidechain contract creation in sidechain, over the bridge (AMB)
     * @return Promise<DataUnion> that resolves when the new DU is deployed over the bridge to side-chain
     */
    async deployDataUnion(options: DataUnionDeployOptions = {}): Promise<DataUnion> {
        const provider = this.ethereum.getProvider()
        const {
            factoryAddress,
            joinPartAgentAddress
        } = this.options.dataUnion

        if (await provider.getCode(factoryAddress) === '0x') {
            throw new Error(`Contract not found at ${factoryAddress}, check DataUnionClient.options.dataUnion.factoryAddress!`)
        }

        const deployerAddress = await this.ethereum.getAddress()

        const {
            owner = deployerAddress,
            joinPartAgents = [owner, joinPartAgentAddress],
            dataUnionName = `DataUnion-${Date.now()}`, // TODO: use uuid
            adminFee = 0,
            confirmations = 1,
            gasPrice
        } = options

        log(`Going to deploy DataUnion with name: ${dataUnionName}`)

        if (adminFee < 0 || adminFee > 1) { throw new Error('options.adminFeeFraction must be a number between 0...1, got: ' + adminFee) }
        const adminFeeBN = BigNumber.from((adminFee * 1e18).toFixed()) // last 2...3 decimals are going to be gibberish

        const ownerAddress = getAddress(owner)
        const agentAddressList = joinPartAgents.map(getAddress)

        const ethersOptions: any = {}
        if (gasPrice) { ethersOptions.gasPrice = gasPrice }
        const duFeeFraction = parseEther('0') // TODO: decide what the default values should be
        const duBeneficiary = '0x0000000000000000000000000000000000000000' // TODO: decide what the default values should be
        const signer = this.ethereum.getSigner()
        const tx = await this.getFactory(factoryAddress, signer).deployNewDataUnion(
            ownerAddress,
            adminFeeBN,
            duFeeFraction,
            duBeneficiary,
            agentAddressList,
            ethersOptions
        )
        const t = await tx.wait(confirmations)

        const createdEvent = t.events?.find((e) => e.event === 'DUCreated')
        if (createdEvent == null) {
            throw new Error('Factory did not emit a DUCreated event!')
        }

        const contractAddress = createdEvent.args!.du
        log(`DataUnion deployed ${contractAddress}`)

        return new DataUnion(contractAddress, this)
    }
}
