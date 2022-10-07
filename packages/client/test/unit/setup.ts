import { ContractFactory } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { parseEther } from '@ethersproject/units'
import { Wallet } from '@ethersproject/wallet'

import { deployToken } from '@streamr/data-v2'

import { DataUnionTemplate as templateJson, DataUnionFactory as factoryJson, DefaultFeeOracle as feeOracleJson } from '@dataunions/contracts'
import type { DataUnionTemplate, DataUnionFactory, IFeeOracle } from '@dataunions/contracts/typechain'

// import debug from 'debug'
// const log = debug('DataUnionClient:unit-tests:withdraw')

const ethereumRpcPort = Number.parseInt(process.env.GANACHE_PORT || "3456")
const ethereumUrl = `http://localhost:${ethereumRpcPort}`
const provider = new JsonRpcProvider(ethereumUrl)

// These privateKeys correspond to "testrpc" mnemonic (start ganache with e.g. `npx ganache -p 3456 -m testrpc &`)
const privateKeys = [
    "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0",
    "0xe5af7834455b7239881b85be89d905d6881dcb4751063897f12be1b0dd546bdb",
    "0x4059de411f15511a85ce332e7a428f36492ab4e87c7830099dadbf130f1896ae",
    "0x633a182fb8975f22aaad41e9008cb49a432e9fdfef37f151e9e7c54e96258ef9",
    "0x957a8212980a9a39bf7c03dcbeea3c722d66f2b359c669feceb0e3ba8209a297",
    "0xfe1d528b7e204a5bdfb7668a1ed3adfee45b4b96960a175c9ef0ad16dd58d728",
    "0xd7609ae3a29375768fac8bc0f8c2f6ac81c5f2ffca2b981e6cf15460f01efe14",
    "0xb1abdb742d3924a45b0a54f780f0f21b9d9283b231a0a0b35ce5e455fa5375e7",
    "0x2cd9855d17e01ce041953829398af7e48b24ece04ff9d0e183414de54dc52285",
]

async function deployDataUnionTemplate(deployer: Wallet): Promise<DataUnionTemplate> {
    const factory = new ContractFactory(templateJson.abi, templateJson.bytecode, deployer)
    const contract = await factory.deploy() as unknown as DataUnionTemplate
    return contract.deployed()
}

async function deployFeeOracle(deployer: Wallet, protocolBeneficiaryAddress: string): Promise<IFeeOracle> {
    const factory = new ContractFactory(feeOracleJson.abi, feeOracleJson.bytecode, deployer)
    const contract = await factory.deploy() as unknown as IFeeOracle
    await contract.initialize(
        parseEther("0.01"),
        protocolBeneficiaryAddress,
    )
    return contract.deployed()
}

async function deployDataUnionFactory(
    deployer: Wallet,
    templateAddress: string,
    tokenAddress: string,
    protocolFeeOracleAddress: string,
): Promise<DataUnionFactory> {
    const factory = new ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer)
    const contract = await factory.deploy() as unknown as DataUnionFactory
    await contract.initialize(
        templateAddress,
        tokenAddress,
        protocolFeeOracleAddress,
    )
    return contract.deployed()
}

export function getWallets(): Wallet[] {
    return privateKeys.map((key) => new Wallet(key, provider))
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function deployContracts(deployer: Wallet) {
    await provider.getNetwork().catch(() => {
        throw new Error('No network found. Please start ganache with `npx ganache -p 3456 -m testrpc &` before running the unit tests')
    })

    const token = await deployToken(deployer)
    await (await token.grantRole(await token.MINTER_ROLE(), deployer.address)).wait()
    const dataUnionTemplate = await deployDataUnionTemplate(deployer)
    const feeOracle = await deployFeeOracle(deployer, deployer.address) // make deployer (the DAO) also protocol beneficiary
    const dataUnionFactory = await deployDataUnionFactory(
        deployer,
        dataUnionTemplate.address,
        token.address,
        feeOracle.address
    )

    return {
        token,
        dataUnionFactory,
        dataUnionTemplate,
        ethereumUrl,
    }
}
