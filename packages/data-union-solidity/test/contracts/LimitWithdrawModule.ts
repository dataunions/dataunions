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
        await dataUnionSidechain.addJoinListener(limitWithdrawModule.address)
        await dataUnionSidechain.addPartListener(limitWithdrawModule.address)
        log("LimitWithdrawModule %s set up successfully", limitWithdrawModule.address)

        await dataUnionSidechain.addJoinPartAgent(creator.address)
        await dataUnionSidechain.addMember(member0.address)
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        log("Member %s was added to data union and is now 'old' enough to withdraw", member0.address)
    })

    it("only lets members withdraw after they've been in the DU long enough", async () => {
        const newMembers = others.slice(0, 2).map(w => w.address)
        await expect(dataUnionSidechain.addMembers(newMembers)).to.emit(dataUnionSidechain, "MemberJoined")
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")

        await expect(dataUnionSidechain.withdrawAll(newMembers[0], false)).to.be.revertedWith("error_memberTooNew")
        await expect(dataUnionSidechain.connect(others[1]).withdrawAllTo(others[2].address, false)).to.be.revertedWith("error_memberTooNew")

        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnionSidechain.withdrawAll(newMembers[0], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await expect(dataUnionSidechain.connect(others[1]).withdrawAllTo(others[2].address, false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")

        // cleanup, TODO: not necessary after hardhat-deploy unit test fixtures are in place
        await dataUnionSidechain.partMembers(newMembers)
    })

    it("only lets data union contract call the methods", async () => {
        await expect(limitWithdrawModule.onJoin(others[0].address)).to.be.revertedWith("error_onlyDataUnionContract")
        await expect(limitWithdrawModule.onPart(others[0].address, "0")).to.be.revertedWith("error_onlyDataUnionContract")
        await expect(limitWithdrawModule.onWithdraw(member0.address, others[0].address, testToken.address, "0")).to.be.revertedWith("error_onlyDataUnionContract")
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
        await expect(dataUnionSidechain.connect(member0).withdrawTo(others[2].address, parseEther("50"), false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
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

    it("denies withdraw from those members withdraw who have been banned", async () => {
        await dataUnionSidechain.addMember(others[3].address)
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])

        // 2 = LeaveConditionCode.BANNED
        const gasLimit = 130000 // TODO: find out if this gas estimation fail happens in dev and real network as well
        await expect(dataUnionSidechain.removeMember(others[3].address, "2", { gasLimit })).to.emit(dataUnionSidechain, "MemberParted")
        await expect(dataUnionSidechain.withdrawAll(others[3].address, false)).to.be.revertedWith("error_withdrawLimit")
    })

    it("lets those members withdraw who have left (without getting banned)", async () => {
        await dataUnionSidechain.addMember(others[4].address)
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])

        await expect(dataUnionSidechain.partMember(others[4].address)).to.emit(dataUnionSidechain, "MemberParted")
        await expect(dataUnionSidechain.withdrawAll(others[4].address, false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
    })

    it("lets those members withdraw who have been restored after getting banned", async () => {
        await dataUnionSidechain.addMember(others[5].address)
        await expect(testToken.transferAndCall(dataUnionSidechain.address, parseEther("10"), "0x")).to.emit(dataUnionSidechain, "RevenueReceived")

        const gasLimit = 130000 // TODO: find out if this gas estimation fail happens in dev and real network as well
        await expect(dataUnionSidechain.removeMember(others[5].address, "2", { gasLimit })).to.emit(dataUnionSidechain, "MemberParted")

        // "restoring" means removing the ban and re-adding the member. See what BanModule does.
        await dataUnionSidechain.addMember(others[5].address)
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnionSidechain.withdrawAll(others[5].address, false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
    })
})
