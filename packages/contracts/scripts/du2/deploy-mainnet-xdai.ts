#!/usr/bin/env ts-node

// TODO: replace this script with https://hardhat.org/plugins/hardhat-deploy.html

import {
    ContractFactory,
    Wallet,
    providers as ethersProviders,
    getDefaultProvider,
    utils as ethersUtils,
    Overrides,
} from "ethers"

import { statSync } from "fs"
import path from "path"

const { JsonRpcProvider } = ethersProviders
const { parseUnits, formatUnits, getAddress } = ethersUtils

const {
    ENV,
    KEY,
    SKIP = "",
    GASPRICE_GWEI,
    SIDECHAIN_TEMPLATE_ADDRESS = "",
    MAINNET_TEMPLATE_ADDRESS = "",
} = process.env

import config from "../../config"
const { mainnet, xdai } = (ENV === "production" ? config.production : config.dev)
const key = KEY || mainnet.keys[0]

if (!key) {
    throw new Error("Please set environment variable KEY to the private key that does the deployment")
}

if (!SKIP) {
    const contractLastBuilt = statSync(path.join(__dirname, "../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json")).mtime
    const lastBuiltMs = Date.now() - contractLastBuilt.getTime()
    if (lastBuiltMs > 1000 * 60 * 60 * 24) {
        console.warn("Contracts are over a day old. Please run `npm run build` or try again with SKIP=0.")
    }
}

import DataUnionSidechainJson from "../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"
import DataUnionMainnetJson from "../artifacts/contracts/DataUnionMainnet.sol/DataUnionMainnet.json"
import DataUnionFactorySidechainJson from "../artifacts/contracts/DataUnionFactorySidechain.sol/DataUnionFactorySidechain.json"
import DataUnionFactoryMainnetJson from "../artifacts/contracts/DataUnionFactoryMainnet.sol/DataUnionFactoryMainnet.json"
// import { DataUnionSidechain, TestToken, BinanceAdapter, MockTokenMediator } from '../typechain'

import Debug from "debug"
const log = Debug("Streamr:du:script:deploy")

// class LoggingProvider extends JsonRpcProvider {
//     async perform(method: string, parameters: any[]) {
//         console.log(">>>", method, parameters);
//         return super.perform(method, parameters).then((result) => {
//             console.log("<<<", method, parameters, result);
//             return result;
//         });
//     }
// }

const ethersOptions: Overrides = { gasLimit: 3000000 }
if (GASPRICE_GWEI) { ethersOptions.gasPrice = parseUnits(GASPRICE_GWEI, "gwei") }

const mainnetProvider = mainnet.url ? new JsonRpcProvider(mainnet.url) : getDefaultProvider()
const sidechainProvider = new JsonRpcProvider(xdai.url ?? "https://rpc.xdaichain.com/")

const sidechainWallet = new Wallet(key, sidechainProvider)
const mainnetWallet = new Wallet(key, mainnetProvider)

async function deploy({ abi, bytecode, contractName }: { abi: any, bytecode: string, contractName: string }, wallet: Wallet, args: any[] = []) { // eslint-disable-line @typescript-eslint/no-explicit-any
    log(`Deploying ${contractName} from ${wallet.address}, bytecode size = ${bytecode.length / 2 - 1} bytes`)
    const factory = new ContractFactory(abi, bytecode, wallet)
    const contract = await factory.deploy(...args, ethersOptions)
    const tx = contract.deployTransaction
    log("Transaction hash:    %s", tx.hash)
    if (tx.gasPrice) {
        log("Gas price:           %s Gwei", formatUnits(tx.gasPrice, "gwei"))
    } else if (tx.maxFeePerGas && tx.maxPriorityFeePerGas && tx.gasLimit) {
        log("Max fee              %s Gwei", formatUnits(tx.maxFeePerGas.mul(tx.gasLimit), "gwei"))
        log("Max priority fee     %s Gwei", formatUnits(tx.maxPriorityFeePerGas.mul(tx.gasLimit), "gwei"))
    }
    const receipt = await tx.wait()
    log("Gas used:            %s", receipt.gasUsed)
    log("Cumulative gas used: %s", receipt.cumulativeGasUsed)
    log("Deployed code size:  %s", (await wallet.provider.getCode(contract.address)).length / 2 - 1)
    // log("Effective gas price: %s", receipt.effectiveGasPrice)
    // log("Cost in ETH:         %s", formatEther(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice)))
    return contract
}

async function deployDUFactories() {
    const duTemplateSidechain = SIDECHAIN_TEMPLATE_ADDRESS ? { address: getAddress(SIDECHAIN_TEMPLATE_ADDRESS) } : await deploy(DataUnionSidechainJson, sidechainWallet)
    console.log(`Data Union template sidechain: ${duTemplateSidechain.address}`)

    const duTemplateMainnet = MAINNET_TEMPLATE_ADDRESS ? { address: getAddress(MAINNET_TEMPLATE_ADDRESS) } : await deploy(DataUnionMainnetJson, mainnetWallet)
    console.log(`Data Union template mainnet: ${duTemplateMainnet.address}`)

    // constructor(address _dataUnionSidechainTemplate)
    const duFactorySidechain = await deploy(DataUnionFactorySidechainJson, sidechainWallet, [
        duTemplateSidechain.address
    ])
    console.log(`Data Union factory sidechain: ${duFactorySidechain.address}`)

    // constructor(
    //      address _dataUnionMainnetTemplate,
    //      address _dataUnionSidechainTemplate,
    //      address _dataUnionSidechainFactory,
    //      address _defaultTokenMainnet,
    //      address _defaultTokenMediatorMainnet,
    //      address _defaultTokenSidechain,
    //      address _defaultTokenMediatorSidechain,
    //      uint256 _sidechainMaxGas
    // )
    const duFactoryMainnet = await deploy(DataUnionFactoryMainnetJson, mainnetWallet, [
        duTemplateMainnet.address,
        duTemplateSidechain.address,
        duFactorySidechain.address,
        mainnet.token,
        mainnet.tokenMediator,
        xdai.token,
        xdai.tokenMediator,
        2000000,
    ])
    console.log(`Data Union factory mainnet: ${duFactoryMainnet.address}`)
    console.log("Don't forget to update the addresses in data-union/packages/config/index.js")
}

async function start() {
    try {
        await deployDUFactories()
    }
    catch (err) {
        console.error(err)
    }
}
start()
