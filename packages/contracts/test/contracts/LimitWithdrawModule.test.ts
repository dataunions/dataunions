import { expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, utils } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:DataUnionSidechain")
// const log = console.log  // for debugging?

import LimitWithdrawModuleJson from "../../artifacts/contracts/LimitWithdrawModule.sol/LimitWithdrawModule.json"
import DataUnionJson from "../../artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json"
import DefaultFeeOracleJson from "../../artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json"

import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"

import type { LimitWithdrawModule, DefaultFeeOracle, DataUnionTemplate as DataUnion, TestToken } from "../../typechain"

// type EthereumAddress = string

use(waffle.solidity)
const { deployContract, provider } = waffle
const { parseEther } = utils

describe("LimitWithdrawModule", () => {
    const [creator, member0, dao, ...others] = provider.getWallets()

    let testToken: TestToken
    let dataUnion: DataUnion

    let limitWithdrawModule: LimitWithdrawModule
    let limitWithdrawModuleArgs: [string, number, number, BigNumber, BigNumber]

    before(async () => {
        testToken = await deployContract(creator, TestTokenJson, ["name", "symbol"]) as TestToken
        await testToken.mint(creator.address, parseEther("10000"))

        const feeOracle = await deployContract(dao, DefaultFeeOracleJson, []) as DefaultFeeOracle
        await feeOracle.initialize(parseEther("0.01"), dao.address)

        dataUnion = await deployContract(creator, DataUnionJson, []) as DataUnion

        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address[] memory initialJoinPartAgents,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     address protocolFeeOracleAddress,
        //     string calldata initialMetadataJsonString
        // )
        await dataUnion.initialize(
            creator.address,
            testToken.address,
            [],
            "1",
            parseEther("0.09"),
            feeOracle.address,
            "{}",
        )
        log("DataUnion %s initialized", dataUnion.address)

        // constructor(
        //     DataUnionSidechain dataUnionAddress,
        //     uint newRequiredMemberAgeSeconds,
        //     uint newWithdrawLimitPeriodSeconds,
        //     uint newWithdrawLimitDuringPeriod,
        //     uint newMinimumWithdrawTokenWei
        // )
        limitWithdrawModuleArgs = [
            dataUnion.address,
            60 * 60 * 24,
            60 * 60,
            parseEther("100"),
            parseEther("1")
        ]
        limitWithdrawModule = await deployContract(creator, LimitWithdrawModuleJson, limitWithdrawModuleArgs) as LimitWithdrawModule
        await dataUnion.setWithdrawModule(limitWithdrawModule.address)
        await dataUnion.addJoinListener(limitWithdrawModule.address)
        await dataUnion.addPartListener(limitWithdrawModule.address)
        log("LimitWithdrawModule %s set up successfully", limitWithdrawModule.address)

        await dataUnion.addJoinPartAgent(creator.address)
        await dataUnion.addMember(member0.address)
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        log("Member %s was added to data union and is now 'old' enough to withdraw", member0.address)
    })

    it("only lets members withdraw after they've been in the DU long enough", async () => {
        const newMembers = others.slice(0, 2).map(w => w.address)
        await expect(dataUnion.addMembers(newMembers)).to.emit(dataUnion, "MemberJoined")
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")).to.emit(dataUnion, "RevenueReceived")

        await expect(dataUnion.withdrawAll(newMembers[0], false)).to.be.revertedWith("error_memberTooNew")
        await expect(dataUnion.connect(others[1]).withdrawAllTo(others[2].address, false)).to.be.revertedWith("error_memberTooNew")

        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnion.withdrawAll(newMembers[0], false)).to.emit(dataUnion, "EarningsWithdrawn")
        await expect(dataUnion.connect(others[1]).withdrawAllTo(others[2].address, false)).to.emit(dataUnion, "EarningsWithdrawn")

        // cleanup, TODO: not necessary after hardhat-deploy unit test fixtures are in place
        await dataUnion.partMembers(newMembers)
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
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")).to.emit(dataUnion, "RevenueReceived")
        await expect(dataUnion.withdraw(member0.address, parseEther("0.1"), false)).to.be.revertedWith("error_withdrawAmountBelowMinimum")
        await expect(dataUnion.connect(member0).withdraw(member0.address, parseEther("0.1"), false)).to.be.revertedWith("error_withdrawAmountBelowMinimum")
    })

    it("limits the amount of withdraws within withdrawLimitPeriodSeconds", async () => {
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("1000"), "0x")).to.emit(dataUnion, "RevenueReceived")
        await expect(dataUnion.withdraw(member0.address, parseEther("200"), false)).to.be.revertedWith("error_withdrawLimit")

        await expect(dataUnion.withdraw(member0.address, parseEther("50"), false)).to.emit(dataUnion, "EarningsWithdrawn")
        await expect(dataUnion.connect(member0).withdrawTo(others[2].address, parseEther("50"), false)).to.emit(dataUnion, "EarningsWithdrawn")
        await expect(dataUnion.withdraw(member0.address, parseEther("1"), false)).to.be.revertedWith("error_withdrawLimit")

        // can not yet withdraw again
        await provider.send("evm_increaseTime", [60])
        await provider.send("evm_mine", [])
        await expect(dataUnion.withdraw(member0.address, parseEther("1"), false)).to.be.revertedWith("error_withdrawLimit")

        // can withdraw again after withdrawLimitPeriodSeconds
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.withdrawLimitPeriodSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnion.withdraw(member0.address, parseEther("100"), false)).to.emit(dataUnion, "EarningsWithdrawn")
    })

    it("denies withdraw from those members withdraw who have been banned", async () => {
        await dataUnion.addMember(others[3].address)
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")).to.emit(dataUnion, "RevenueReceived")
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])

        // 2 = LeaveConditionCode.BANNED
        await expect(dataUnion.removeMember(others[3].address, "2")).to.emit(dataUnion, "MemberParted")
        const balanceBefore = await testToken.balanceOf(others[3].address)
        await expect(dataUnion.withdrawAll(others[3].address, false)).to.not.emit(dataUnion, "EarningsWithdrawn")
        const balanceIncrease = (await testToken.balanceOf(others[3].address)).sub(balanceBefore)
        expect(+balanceIncrease).to.eq(0)
    })

    it("lets those members withdraw who have left (without getting banned)", async () => {
        await dataUnion.addMember(others[4].address)
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")).to.emit(dataUnion, "RevenueReceived")
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])

        await expect(dataUnion.partMember(others[4].address)).to.emit(dataUnion, "MemberParted")
        await expect(dataUnion.withdrawAll(others[4].address, false)).to.emit(dataUnion, "EarningsWithdrawn")
    })

    it("lets those members withdraw who have been restored after getting banned", async () => {
        await dataUnion.addMember(others[5].address)
        await expect(testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")).to.emit(dataUnion, "RevenueReceived")

        await expect(dataUnion.removeMember(others[5].address, "2")).to.emit(dataUnion, "MemberParted")

        // "restoring" means removing the ban and re-adding the member. See what BanModule does.
        await dataUnion.addMember(others[5].address)
        await provider.send("evm_increaseTime", [+await limitWithdrawModule.requiredMemberAgeSeconds()])
        await provider.send("evm_mine", [])
        await expect(dataUnion.withdrawAll(others[5].address, false)).to.emit(dataUnion, "EarningsWithdrawn")
    })
})
