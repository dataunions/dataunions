import { expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, utils } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:DataUnionSidechain")
// const log = console.log  // for debugging?

import LimitWithdrawModuleJson from "../../artifacts/contracts/LimitWithdrawModule.sol/LimitWithdrawModule.json"
import DataUnionSidechainJson from "../../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"

import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"
import MockTokenMediatorJson from "../../artifacts/contracts/test/MockTokenMediator.sol/MockTokenMediator.json"
import MockAMBJson from "../../artifacts/contracts/test/MockAMB.sol/MockAMB.json"

import type { LimitWithdrawModule, DataUnionSidechain, MockTokenMediator, TestToken, MockAMB } from "../../typechain"

// type EthereumAddress = string

use(waffle.solidity)
const { deployContract, provider } = waffle
const { parseEther } = utils

describe("LimitWithdrawModule", () => {
    const [creator, member0, ...others] = provider.getWallets()
    const otherAddresses = others.map(o => o.address)

    let testToken: TestToken
    let dataUnionSidechain: DataUnionSidechain
    let mockAMB: MockAMB
    let mockTokenMediator: MockTokenMediator

    let limitWithdrawModule: LimitWithdrawModule
    let limitWithdrawModuleArgs: [string, number, number, BigNumber, BigNumber]

    before(async () => {
        testToken = await deployContract(creator, TestTokenJson, ["name", "symbol"]) as TestToken
        await testToken.mint(creator.address, parseEther("10000"))

        mockAMB = await deployContract(creator, MockAMBJson, []) as MockAMB
        mockTokenMediator = await deployContract(creator, MockTokenMediatorJson, [testToken.address, mockAMB.address]) as MockTokenMediator

        dataUnionSidechain = await deployContract(creator, DataUnionSidechainJson, []) as DataUnionSidechain

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
            mockTokenMediator.address,
            [],
            creator.address,  // dummy
            "1",
            parseEther("0.1"),
            parseEther("0.1"),
            creator.address
        )
        log("DataUnionSidechain %s initialized", dataUnionSidechain.address)

        // constructor(
        //     DataUnionSidechain dataUnionAddress,
        //     uint newRequiredMemberAgeSeconds,
        //     uint newWithdrawLimitPeriodSeconds,
        //     uint newWithdrawLimitDuringPeriod,
        //     uint newMinimumWithdrawTokenWei
        // )
        limitWithdrawModuleArgs = [
            dataUnionSidechain.address,
            60 * 60 * 24,
            60 * 60,
            parseEther("100"),
            parseEther("1")
        ]
        limitWithdrawModule = await deployContract(creator, LimitWithdrawModuleJson, limitWithdrawModuleArgs) as LimitWithdrawModule
        await dataUnionSidechain.setWithdrawModule(limitWithdrawModule.address)
        await dataUnionSidechain.addJoinPartListener(limitWithdrawModule.address)
        log("LimitWithdrawModule %s set up successfully", limitWithdrawModule.address)

        await dataUnionSidechain.addJoinPartAgent(creator.address)
        await dataUnionSidechain.addMember(member0.address)
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        log("%s was added to data union and is now 'old' enough to withdraw", member0.address)
    })

    it("only lets members withdraw after they've been in the DU long enough", async () => {
        await expect(dataUnionSidechain.addMembers(otherAddresses.slice(0, 2))).to.emit(dataUnionSidechain, "MemberJoined")
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")

        await expect(dataUnionSidechain.withdrawAll(otherAddresses[0], false)).to.be.revertedWith("error_memberTooNew")
        await expect(dataUnionSidechain.connect(others[1]).withdrawAllTo(otherAddresses[2], false)).to.be.revertedWith("error_memberTooNew")

        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnionSidechain.withdrawAll(otherAddresses[0], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await expect(dataUnionSidechain.connect(others[1]).withdrawAllTo(otherAddresses[2], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")

        // cleanup, TODO: not necessary after hardhat-deploy unit test fixtures are in place
        await dataUnionSidechain.partMembers(otherAddresses.slice(0, 2))
    })

    it("only lets joinPartAgents add members", async () => {
        await dataUnionSidechain.removeJoinPartAgent(creator.address)
        await expect(dataUnionSidechain.addMembers(otherAddresses.slice(0, 2))).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionSidechain.addMember(otherAddresses[0])).to.be.revertedWith("error_onlyJoinPartAgent")

        // cleanup, TODO: not necessary after hardhat-deploy unit test fixtures are in place
        await dataUnionSidechain.addJoinPartAgent(creator.address)
    })

    it("only lets admin reset the module", async () => {
        await expect(limitWithdrawModule.connect(member0).setParameters(...limitWithdrawModuleArgs)).to.be.revertedWith("error_onlyOwner")
        await expect(limitWithdrawModule.setParameters(...limitWithdrawModuleArgs)).to.emit(limitWithdrawModule, "ModuleReset")
    })

    it("only accepts withdraws > minimumWithdrawTokenWei", async () => {
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")
        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("0.1"), false)).to.be.revertedWith("error_withdrawAmountBelowMinimum")
        await expect(dataUnionSidechain.connect(member0).withdraw(member0.address, parseEther("0.1"), false)).to.be.revertedWith("error_withdrawAmountBelowMinimum")
    })

    it("limits the amount of withdraws within withdrawLimitPeriodSeconds", async () => {
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("1000"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")
        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("200"), false)).to.be.revertedWith("error_withdrawLimit")

        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("50"), false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await expect(dataUnionSidechain.connect(member0).withdrawTo(otherAddresses[1], parseEther("50"), false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("1"), false)).to.be.revertedWith("error_withdrawLimit")

        // can not yet withdraw again
        await provider.send("evm_increaseTime", [60])
        await provider.send("evm_mine", [])
        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("1"), false)).to.be.revertedWith("error_withdrawLimit")

        // can withdraw again after withdrawLimitPeriodSeconds
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.withdrawLimitPeriodSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnionSidechain.withdraw(member0.address, parseEther("100"), false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
    })
})