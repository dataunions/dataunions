#!/usr/bin/env ts-node

import {
    ContractFactory,
    Wallet,
    providers as ethersProviders,
    getDefaultProvider,
} from "ethers"

import { statSync } from 'fs'

const { JsonRpcProvider } = ethersProviders

const {
    MAINNET_URL,
    XDAI_URL,
    KEY,
    SKIP_CHECK,
} = process.env

if (!SKIP_CHECK) {
    const contractLastBuilt = statSync("../packages/data-union-solidity/artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json").mtime
    const lastBuiltMs = Date.now() - contractLastBuilt.getTime()
    if (lastBuiltMs > 1000 * 60 * 60 * 24) {
        console.warn("Contracts are over a day old. Please run `npm run build` or try again with SKIP_CHECK=1.")
    }
}

import DataUnionSidechainJson from "../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"
import DataUnionMainnetJson from "../artifacts/contracts/DataUnionMainnet.sol/DataUnionMainnet.json"
import DataUnionFactorySidechainJson from "../artifacts/contracts/DataUnionFactorySidechain.sol/DataUnionFactorySidechain.json"
import DataUnionFactoryMainnetJson from "../artifacts/contracts/DataUnionFactoryMainnet.sol/DataUnionFactoryMainnet.json"
// import { DataUnionSidechain, TestToken, BinanceAdapter, MockTokenMediator } from '../packages/data-union-solidity/typechain'

import Debug from "debug"
const log = Debug("Streamr:du:script:deploy")

class LoggingProvider extends JsonRpcProvider {
    async perform(method: string, parameters: any[]) {
        console.log(">>>", method, parameters);
        return super.perform(method, parameters).then((result) => {
            console.log("<<<", method, parameters, result);
            return result;
        });
    }
}

const provider_foreign = MAINNET_URL ? new JsonRpcProvider(MAINNET_URL) : getDefaultProvider();
const provider_home = new JsonRpcProvider(XDAI_URL ?? 'https://rpc.xdaichain.com/');

const wallet_home = new Wallet(KEY, provider_home)
const wallet_foreign = new Wallet(KEY, provider_foreign)

// TODO: add config file, maybe separate package to NPM?
const tokenMainnetAddress = '0x8f693ca8D21b157107184d29D398A8D082b38b76'
const tokenSidechainAddress = '0xE4a2620edE1058D61BEe5F45F6414314fdf10548'
const tokenMediatorMainnetAddress = '0x2eeeDdeECe91c9F4c5bA4C8E1d784A0234C6d015'
const tokenMediatorSidechainAddress = '0xf6a78083ca3e2a662d6dd1703c939c8ace2e268d'

async function deployDUFactories() {
    log(`Deploying template DU home contract from ${wallet_home.address}`)
    const deployerST = new ContractFactory(DataUnionSidechainJson.abi, DataUnionSidechainJson.bytecode, wallet_home)
    const dtxST = await deployerST.deploy({ gasLimit: 6000000 })
    const duhome = await dtxST.deployed()
    console.log(`duhome template: ${duhome.address}`)

    log(`Deploying template DU mainnet contract from ${wallet_foreign.address}`)
    const deployerMT = new ContractFactory(DataUnionMainnetJson.abi, DataUnionMainnetJson.bytecode, wallet_foreign)
    const dtxMT = await deployerMT.deploy({ gasLimit: 2000000 })
    const duforeign = await dtxMT.deployed()
    console.log(`duforeign template: ${duforeign.address}`)

    // constructor(address _dataUnionSidechainTemplate)
    log(`Deploying sidechain DU factory contract from ${wallet_home.address}`)
    const deployerSF = new ContractFactory(DataUnionFactorySidechainJson.abi, DataUnionFactorySidechainJson.bytecode, wallet_home)
    const dtxSF = await deployerSF.deploy(duhome.address, { gasLimit: 6000000 })
    const factSidechain = await dtxSF.deployed()
    console.log(`factorySidechain: ${factSidechain.address}`)

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
    log(`Deploying DU mainnet factory contract from ${wallet_foreign.address}`)
    const deployerMF = new ContractFactory(DataUnionFactoryMainnetJson.abi, DataUnionFactoryMainnetJson.bytecode, wallet_foreign)
    const dtxMF = await deployerMF.deploy(
        duforeign.address,
        duhome.address,
        factSidechain.address,
        tokenMediatorMainnetAddress,
        factSidechain.address,
        2000000, { gasLimit: 2000000 })
    const factMainnet = await dtxMF.deployed()
    console.log(`factMainnet: ${factMainnet.address}`)
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

