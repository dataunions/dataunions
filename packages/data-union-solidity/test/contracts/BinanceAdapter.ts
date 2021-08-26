import { expect, use } from 'chai'
import { waffle } from 'hardhat'
import { BigNumber, Wallet, Contract, Signer, utils } from 'ethers'

import DataUnionSidechainJson from "../../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"
import MockTokenMediatorJson from "../../artifacts/contracts/MockTokenMediator.sol/MockTokenMediator.json"
import TestTokenJson from "../../artifacts/contracts/TestToken.sol/TestToken.json"
import BinanceAdapterJson from "../../artifacts/contracts/BinanceAdapter.sol/BinanceAdapter.json"
import MockAMBJson from "../../artifacts/contracts/MockAMB.sol/MockAMB.json"

// Uniswap v2, originally from @uniswap/v2-periphery/build
import UniswapV2FactoryJson from "../utils/UniswapV2Factory.json"
// const UniswapV2PairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json")
import UniswapV2Router02Json from "../utils/UniswapV2Router02.json"
import WETH9Json from "../utils/WETH9.json"

import Debug from "debug"
import { DataUnionSidechain, TestToken, BinanceAdapter, MockTokenMediator } from '../../typechain'
const log = Debug("Streamr:du:test:BinanceAdapter")

use(waffle.solidity)
const { deployContract, provider } = waffle
const { parseEther } = utils

//const log = console.log  // for debugging?

type EthereumAddress = string

const futureTime = 4449513600
/**
 * In Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.
 * web3.eth.encodeParameters() encodes addresses padded as 32bytes, so it can't be used
 * encodePacked() method from library would be preferable, but this works
 */
async function makeSetBinanceRecipientSignature(to: EthereumAddress, nonce: BigNumber, adapterAddress: EthereumAddress, signer: Wallet) {
    const message = to + nonce.toHexString().slice(2).padStart(64, "0") + adapterAddress.slice(2)
    log("message:", message)
    const signature = await signer.signMessage(message)
    log("signature:", signature)
    return signature
}

describe("BinanceAdapter", (): void => {
    const accounts = provider.getWallets()
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)

    const m = members.map(member => member.address)
    const a = agents.map(agent => agent.address)
    const o = others.map(outsider => outsider.address)

    let testToken: TestToken
    let otherToken: TestToken
    let dataUnionSidechain: DataUnionSidechain
    let dataUnionSidechainAgent: DataUnionSidechain
    let dataUnionSidechainMember0: DataUnionSidechain
    let mockBinanceMediator: MockTokenMediator
    let uniswapRouter: Contract

    const dummyAddress = "0x0000000000000000000000000000000000001234"

    before(async () => {
        const weth = await deployContract(creator, WETH9Json, [])
        log(`WETH deployed to ${weth.address}`)
        const factory = await deployContract(creator, UniswapV2FactoryJson, [creator.address])
        uniswapRouter = await deployContract(creator, UniswapV2Router02Json, [factory.address, weth.address])
        log(`created uniswapRouter: ${uniswapRouter.address}`)

        testToken = await deployContract(creator, TestTokenJson, ["name", "symbol"]) as TestToken
        otherToken = await deployContract(creator, TestTokenJson, ["migrate", "m"]) as TestToken

        await testToken.mint(creator.address, parseEther("10000"))
        await otherToken.mint(creator.address, parseEther("10000"))

        // no conversion until we install Uniswap contract
        //    constructor(address dataCoin_, address honeyswapRouter_, address bscBridge_, address convertToCoin_, address liquidityToken_) public {
        const mockAMB = await deployContract(creator, MockAMBJson, [])
        mockBinanceMediator = await deployContract(creator, MockTokenMediatorJson, [testToken.address, mockAMB.address]) as MockTokenMediator

        // set up an exchange rate in the liquidity pool: 10 testToken ~= 1 otherToken
        const amtTest = parseEther("1000")
        const amtOther = parseEther("100")
        await testToken.approve(uniswapRouter.address, amtTest)
        await otherToken.approve(uniswapRouter.address, amtOther)
        await uniswapRouter.addLiquidity(testToken.address, otherToken.address, amtTest, amtOther, 0, 0, creator.address, futureTime)

        log("List of relevant addresses:")
        log("  mockBinanceMediator: ", mockBinanceMediator.address)
        log("  mockAMB: ", mockAMB.address)
        log("  testToken: ", testToken.address)
        log("  creator: ", creator.address)
        log("  agents: %o", a)
        log("  members: %o", m)
        log("  outsider addresses used in tests: %o", others.map(x => x.address))
    })

    beforeEach(async () => {
        const dummyAddress = a[0]

        dataUnionSidechain = await deployContract(creator, DataUnionSidechainJson, []) as DataUnionSidechain
        dataUnionSidechainAgent = dataUnionSidechain.connect(agents[1])
        dataUnionSidechainMember0 = dataUnionSidechain.connect(members[0])

        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address tokenMediatorAddress,
        //     address[] memory initialJoinPartAgents,
        //     address mainnetDataUnionAddress,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     uint256 initialDataUnionFeeFraction,
        //     address initialDataUnionBeneficiary
        // )
        await dataUnionSidechain.initialize(
            creator.address,
            testToken.address,
            mockBinanceMediator.address,
            a,
            dummyAddress,
            "1",
            parseEther("0.1"),
            parseEther("0.1"),
            dummyAddress
        )
        await dataUnionSidechainAgent.addMembers(m)

        log(`DataUnionSidechain initialized at ${dataUnionSidechain.address}`)
    })

    it("can set Binance recipient", async () => {
        const adapter = await deployContract(creator, BinanceAdapterJson, [testToken.address, dummyAddress, mockBinanceMediator.address, dummyAddress, dummyAddress]) as BinanceAdapter
        const adapterMember0 = adapter.connect(members[0])

        await expect(adapterMember0.setBinanceRecipient(m[1])).to.emit(adapter, "SetBinanceRecipient")
        const newRecipient0 = (await adapter.binanceRecipient(m[0]))[0]
        expect(m[1]).to.equal(newRecipient0)

        // set m[1]'s recipient to member[2] using signature
        const nonce = (await adapter.binanceRecipient(m[1]))[1].add(1)
        const sig = await makeSetBinanceRecipientSignature(m[2], nonce, adapter.address, members[1])
        log(`nonce ${nonce} sig ${sig} ${m[1]} ${m[2]}`)
        await adapterMember0.setBinanceRecipientFromSig(m[1], m[2], sig)
        const newRecipient1 = (await adapter.binanceRecipient(m[1]))[0]
        expect(m[2]).to.equal(newRecipient1)

        //replay should fail
        await expect(adapter.setBinanceRecipientFromSig(m[1], m[2], sig)).to.be.reverted
    })

    it("can withdraw to mediator without conversion", async () => {
        const adapter = await deployContract(creator, BinanceAdapterJson, [testToken.address, dummyAddress, mockBinanceMediator.address, dummyAddress, dummyAddress]) as BinanceAdapter

        await testToken.transferAndCall(dataUnionSidechain.address, "300", "0x")
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(80) // == (300 - fees) / 3

        //m[0] withdraws to member[1] via bridge
        await adapter.connect(members[0]).setBinanceRecipient(m[1])
        await dataUnionSidechainMember0.withdrawAllTo(adapter.address, false)

        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(0)
        expect(await testToken.balanceOf(mockBinanceMediator.address)).to.equal(0)
        expect(await testToken.balanceOf(m[0])).to.equal(0)
        expect(await testToken.balanceOf(m[1])).to.equal(80)
    })

    it("can withdraw to mediator with conversion", async () => {
        const adapter = await deployContract(creator, BinanceAdapterJson, [testToken.address, dummyAddress, mockBinanceMediator.address, dummyAddress, dummyAddress]) as BinanceAdapter

        await testToken.transferAndCall(dataUnionSidechain.address, "300", "0x")
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(80) // == (300 - fees) / 3

        // members[0] withdraws to members[1] via bridge
        await adapter.connect(members[0]).setBinanceRecipient(m[1])
        await dataUnionSidechainMember0.withdrawAllTo(adapter.address, false)

        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(0)
        expect(await testToken.balanceOf(mockBinanceMediator.address)).to.equal(0)
        expect(await testToken.balanceOf(m[0])).to.equal(0)

        // otherToken balance should be a bit less than bal/10
        expect(await otherToken.balanceOf(m[1])).to.be.greaterThan(5)
    })

})
