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

import { statSync } from 'fs'
import path from 'path'

const { JsonRpcProvider } = ethersProviders
const { parseUnits, formatUnits } = ethersUtils

const {
    ENV,
    KEY,
    SKIP = "",
    GASPRICE_GWEI,
} = process.env

import config from "../../config"
const { mainnet, xdai } = (ENV === "production" ? config.production : config.dev)

if (!KEY) {
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

const mainnetProvider = mainnet.url ? new JsonRpcProvider(mainnet.url) : getDefaultProvider();
const sidechainProvider = new JsonRpcProvider(xdai.url ?? 'https://rpc.xdaichain.com/');

const sidechainWallet = new Wallet(KEY, sidechainProvider)
const mainnetWallet = new Wallet(KEY, mainnetProvider)

async function deploy(factory: ContractFactory, args: any[]) {
    const contract = await factory.deploy(...args, ethersOptions)
    log("Transaction hash:    %s", contract.deployTransaction.hash)
    log("Gas price:           %s Gwei", contract.deployTransaction.gasPrice ? formatUnits(contract.deployTransaction.gasPrice, "gwei") : "?")
    const receipt = await contract.deployTransaction.wait()
    log("Gas used:            %s", receipt.gasUsed)
    log("Cumulative gas used: %s", receipt.cumulativeGasUsed)
    // log("Effective gas price: %s", receipt.effectiveGasPrice)
    // log("Cost in ETH:         %s", formatEther(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice)))
    return contract
}

async function deployDUFactories() {
    log(`Deploying template DU home contract from ${sidechainWallet.address}`)
    const duTemplateSidechain = await deploy(
        new ContractFactory(DataUnionSidechainJson.abi, DataUnionSidechainJson.bytecode, sidechainWallet),
        []
    )
    console.log(`Data Union template sidechain: ${duTemplateSidechain.address}`)

    log(`Deploying template DU mainnet contract from ${mainnetWallet.address}`)
    const duTemplateMainnet = await deploy(
        new ContractFactory(DataUnionMainnetJson.abi, DataUnionMainnetJson.bytecode, mainnetWallet),
        []
    )
    console.log(`Data Union template mainnet: ${duTemplateMainnet.address}`)

    // constructor(address _dataUnionSidechainTemplate)
    log(`Deploying sidechain DU factory contract from ${sidechainWallet.address}`)
    const duFactorySidechain = await deploy(
        new ContractFactory(DataUnionFactorySidechainJson.abi, DataUnionFactorySidechainJson.bytecode, sidechainWallet),
        [
            duTemplateSidechain.address
        ]
    )
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
    log(`Deploying DU mainnet factory contract from ${mainnetWallet.address}`)
    const duFactoryMainnet = await deploy(
        new ContractFactory(DataUnionFactoryMainnetJson.abi, DataUnionFactoryMainnetJson.bytecode, mainnetWallet),
        [
            duTemplateMainnet.address,
            duTemplateSidechain.address,
            duFactorySidechain.address,
            mainnet.token,
            mainnet.tokenMediator,
            xdai.token,
            xdai.tokenMediator,
            2000000,
        ]
    )
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
