#!/usr/bin/env ts-node

// TODO: replace this script with https://hardhat.org/plugins/hardhat-deploy.html

import {
    Contract,
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
    MAINNET_FACTORY_ADDRESS = "",
    DU_NAME,
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

import DataUnionFactoryMainnetJson from "../artifacts/contracts/DataUnionFactoryMainnet.sol/DataUnionFactoryMainnet.json"
import { DataUnionFactoryMainnet } from "../typechain"

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

async function deployDU() {
    const factoryAddress = getAddress(MAINNET_FACTORY_ADDRESS)
    const factory = new Contract(factoryAddress, DataUnionFactoryMainnetJson.abi, mainnetWallet) as DataUnionFactoryMainnet
    console.log("Data Union factory mainnet: %s", factory.address)
    const duname = DU_NAME || "test" + Date.now()

    const duMainnetAddress = await factory.mainnetAddress(mainnetWallet.address, duname)
    const duSidechainAddress = await factory.sidechainAddress(duMainnetAddress)
    log("Deploying DU: name=%s, mainnet=%s, sidechain=%s", duname, duMainnetAddress, duSidechainAddress)

    // function deployNewDataUnionUsingToken(
    //     address tokenMainnet,
    //     address tokenMediatorMainnet,
    //     address tokenSidechain,
    //     address tokenMediatorSidechain,
    //     address owner,
    //     uint256 adminFeeFraction,
    //     uint256 duFeeFraction,
    //     address duBeneficiary,
    //     address[] memory agents,
    //     string memory name
    // )
    const tx = await factory.deployNewDataUnionUsingToken(
        getAddress(mainnet.token),
        getAddress(mainnet.tokenMediator),
        getAddress(xdai.token),
        getAddress(xdai.tokenMediator),
        sidechainWallet.address,
        parseUnits("0.1", "ether"),
        parseUnits("0.1", "ether"),
        sidechainWallet.address,
        [],
        duname,
    )
    const tr = await tx.wait()
    log("Transaction logs: %o", tr.logs)
}

async function start() {
    try {
        await deployDU()
    }
    catch (err) {
        console.error(err)
    }
}
start()
