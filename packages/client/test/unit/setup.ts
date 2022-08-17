import { Contract, ContractFactory } from '@ethersproject/contracts'
import { Web3Provider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import * as ganache from 'ganache'

import { deployToken } from '@streamr/data-v2'
import type { DATAv2 } from '@streamr/data-v2'

import { dataUnionTemplate as templateJson, dataUnionFactory as factoryJson } from '@dataunions/contracts'
import type { DataUnionTemplate, DataUnionFactory } from '@dataunions/contracts/typechain'

import debug from 'debug'
import { waitForCondition } from 'streamr-test-utils'
const log = debug('DataUnionClient:unit-tests:withdraw')

// const ganacheProvider = new JsonRpcProvider('http://localhost:3456')

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

let ganacheProvider: ganache.EthereumProvider
let ethereumRpcPort: number
// beforeAll(async () => {
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function startServer(port: number) {
    ethereumRpcPort = port
    // const ethereumRpcPort = Number.parseInt(process.env.GANACHE_PORT || "3456")
    const ethereumRpcServer = ganache.server({
        // options, see https://github.com/trufflesuite/ganache/tree/develop/src/packages/ganache#startup-options
        wallet: {
            mnemonic: "testrpc"
        },
        logging: {
            quiet: true // if only I could make it log to debug, not stdout...
        }
    })
    ethereumRpcServer.listen(ethereumRpcPort, async (err) => {
        if (err) { throw err }
        log(`Ganache started in port ${ethereumRpcPort}`)
        ganacheProvider = ethereumRpcServer.provider
    })
    await waitForCondition(() => ganacheProvider !== undefined)

    // @ts-expect-error probably some incompatibility between ethers and ganache
    const provider = new Web3Provider(ganacheProvider)
    return {
        server: ethereumRpcServer,
        wallets: privateKeys.map((key) => new Wallet(key, provider))
    }
}

// afterAll(async () => {
//     await ethereumRpcServer.close()
// })

async function deployDataUnionTemplate(deployer: Wallet): Promise<DataUnionTemplate> {
    const factory = new ContractFactory(templateJson.abi, templateJson.bytecode, deployer)
    const contract = await factory.deploy() as unknown as DataUnionTemplate
    return contract.deployed()
}

async function deployDataUnionFactory(deployer: Wallet, templateAddress: string, tokenAddress: string): Promise<DataUnionFactory> {
    const factory = new ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer)
    const contract = await factory.deploy(templateAddress, tokenAddress) as unknown as DataUnionFactory
    return contract.deployed()
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function deployContracts(deployer: Wallet) {
    await waitForCondition(() => ganacheProvider !== undefined)

    const token = await deployToken(deployer)
    await (await token.grantRole(await token.MINTER_ROLE(), deployer.address)).wait()
    const dataUnionTemplate = await deployDataUnionTemplate(deployer)
    const dataUnionFactory = await deployDataUnionFactory(deployer, dataUnionTemplate.address, token.address)

    return {
        token,
        dataUnionFactory,
        dataUnionTemplate,
        ethereumUrl: `http://localhost:${ethereumRpcPort}`,
    }
}

// TODO: remove this, use client.deployDataUnion() instead
export async function deployDataUnion(duFactory: DataUnionFactory, token: DATAv2): Promise<DataUnionTemplate> {
    const ownerAddress = await duFactory.signer.getAddress()
    // function deployNewDataUnionUsingToken(
    //     address token,
    //     address payable owner,
    //     address[] memory agents,
    //     uint256 initialAdminFeeFraction,
    //     uint256 initialDataUnionFeeFraction,
    //     address initialDataUnionBeneficiary
    // )
    const tx = await duFactory.deployNewDataUnionUsingToken(
        token.address,
        ownerAddress,
        [ownerAddress],
        "0",
        "0",
        "0x0000000000000000000000000000000000000000"
    )
    const receipt = await tx.wait()
    const createdEvent = receipt.events?.find((e) => e.event === 'DUCreated')
    if (createdEvent == null) { throw new Error('Factory did not emit a DUCreated event!') }
    const contractAddress = createdEvent.args!.du
    log(`DataUnion deployed at ${contractAddress}`)
    return new Contract(contractAddress, templateJson.abi, duFactory.signer) as unknown as DataUnionTemplate
}