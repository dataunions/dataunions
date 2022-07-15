import { providers, Contract, Signer, ContractFactory } from "ethers"

import * as duTemplate from "./artifacts/contracts/unichain/DataUnionTemplate.sol/DataUnionTemplate.json"
import * as duFactory from "./artifacts/contracts/unichain/DataUnionFactory.sol/DataUnionFactory.json"

import type { DataUnionTemplate, DataUnionFactory } from "./typechain"

export function dataUnionTemplateAt(address: string, signerOrProvider: providers.Provider | Signer): DataUnionTemplate {
    return new Contract(address, duTemplate.abi, signerOrProvider) as DataUnionTemplate
}

export async function deployDataUnionTemplate(signer: Signer): Promise<DataUnionTemplate> {
    const factory = new ContractFactory(duTemplate.abi, duTemplate.bytecode, signer)
    const contract = await factory.deploy() as DataUnionTemplate
    return contract.deployed()
}

export function dataUnionFactoryAt(address: string, signerOrProvider: providers.Provider | Signer): DataUnionFactory {
    return new Contract(address, duFactory.abi, signerOrProvider) as DataUnionFactory
}

export async function deployDataUnionFactory(signer: Signer): Promise<DataUnionFactory> {
    const factory = new ContractFactory(duFactory.abi, duFactory.bytecode, signer)
    const contract = await factory.deploy() as DataUnionFactory
    return contract.deployed()
}
