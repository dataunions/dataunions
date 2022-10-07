#!/usr/bin/env ts-node

// TODO: replace this script with https://hardhat.org/plugins/hardhat-deploy.html

import {
    ContractFactory,
    Wallet,
    providers as ethersProviders,
    Contract,
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
    DU_ADDRESS = "",
    BAN_MODULE_ADDRESS = "",
    REQUIRED_MEMBER_AGE_SECONDS = "2592000",  // 30 days
    WITHDRAW_LIMIT_PERIOD_SECONDS = "2592000",  // 30 days
    WITHDRAW_LIMIT_DURING_PERIOD = "1000000000000000000000000000000",  // ~1000 x supply = enough
    MINIMUM_WITHDRAW_TOKEN_WEI = "10000000000000000000", // 10 tokens
} = process.env

import config from "../../config"
const { xdai } = (ENV === "production" ? config.production : config.dev)

if (!KEY) {
    throw new Error("Please set environment variable KEY to the private key that does the deployment")
}

if (!SKIP) {
    const contractLastBuilt = statSync(path.join(__dirname, "../artifacts/contracts/BanModule.sol/BanModule.json")).mtime
    const lastBuiltMs = Date.now() - contractLastBuilt.getTime()
    if (lastBuiltMs > 1000 * 60 * 60 * 24) {
        console.warn("Contracts are over a day old. Please run `npm run build` or try again with SKIP=0.")
    }
}

import DataUnionSidechainJson from "../../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"
import BanModuleJson from "../../artifacts/contracts/BanModule.sol/BanModule.json"
import LimitWithdrawModuleJson from "../../artifacts/contracts/LimitWithdrawModule.sol/LimitWithdrawModule.json"
import { DataUnionSidechain } from "../../typechain"

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

const xdaiProvider = new JsonRpcProvider(xdai.url ?? "https://rpc.xdaichain.com/")

const xdaiWallet = new Wallet(KEY, xdaiProvider)

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

async function deployModules() {
    const dataUnionAddress = getAddress(DU_ADDRESS)
    const dataUnion = new Contract(dataUnionAddress, DataUnionSidechainJson.abi, xdaiWallet) as DataUnionSidechain
    console.log(`Data Union sidechain: ${dataUnion.address}`)

    const banModule = BAN_MODULE_ADDRESS ? { address: getAddress(BAN_MODULE_ADDRESS) } : await deploy(BanModuleJson, xdaiWallet, [dataUnion.address])
    console.log(`BanModule: ${banModule.address}`)
    if (SKIP === "admin") {
        console.log("Skipping admin setup, please call addJoinListener(%s) and addJoinPartAgent(%s)", banModule.address, banModule.address)
    } else {
        const tr = await (await dataUnion.addJoinListener(banModule.address)).wait()
        log(`Added join listener, events: ${tr.events?.map(e => e.event)}`)
        const tr2 = await (await dataUnion.addJoinPartAgent(banModule.address)).wait()
        log(`Added join part agent, events: ${tr2.events?.map(e => e.event)}`)
    }

    // constructor(
    //     DataUnionSidechain dataUnionAddress,
    //     uint newRequiredMemberAgeSeconds,
    //     uint newWithdrawLimitPeriodSeconds,
    //     uint newWithdrawLimitDuringPeriod,
    //     uint newMinimumWithdrawTokenWei
    // )
    const limitWithdrawModule = await deploy(LimitWithdrawModuleJson, xdaiWallet, [
        dataUnion.address,
        REQUIRED_MEMBER_AGE_SECONDS,
        WITHDRAW_LIMIT_PERIOD_SECONDS,
        WITHDRAW_LIMIT_DURING_PERIOD,
        MINIMUM_WITHDRAW_TOKEN_WEI,
    ])
    console.log(`LimitWithdrawModule: ${limitWithdrawModule.address}`)
    if (SKIP === "admin") {
        console.log("Skipping admin setup, please call setWithdrawModule(%s) and addJoinListener(%s) and addPartListener(%s)", limitWithdrawModule.address, limitWithdrawModule.address, limitWithdrawModule.address)
    } else {
        const tr1 = await (await dataUnion.setWithdrawModule(limitWithdrawModule.address)).wait()
        log(`Set withdraw module, events: ${tr1.events?.map(e => e.event)}`)
        const tr2 = await (await dataUnion.addJoinListener(limitWithdrawModule.address)).wait()
        log(`Added join listener, events: ${tr2.events?.map(e => e.event)}`)
        const tr3 = await (await dataUnion.addPartListener(limitWithdrawModule.address)).wait()
        log(`Added part listener, events: ${tr3.events?.map(e => e.event)}`)
    }
}

async function start() {
    try {
        await deployModules()
    }
    catch (err) {
        console.error(err)
    }
}
start()
