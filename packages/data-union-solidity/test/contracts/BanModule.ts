import { expect, use } from "chai"
import { waffle } from "hardhat"
import { utils } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:DataUnionSidechain")
// const log = console.log  // for debugging?

import BanModuleJson from "../../artifacts/contracts/BanModule.sol/BanModule.json"
import DataUnionSidechainJson from "../../artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json"

import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"
import MockTokenMediatorJson from "../../artifacts/contracts/test/MockTokenMediator.sol/MockTokenMediator.json"
import MockAMBJson from "../../artifacts/contracts/test/MockAMB.sol/MockAMB.json"

import type { BanModule, DataUnionSidechain, MockTokenMediator, TestToken, MockAMB } from "../../typechain"

// type EthereumAddress = string

use(waffle.solidity)
const { deployContract, provider } = waffle
const { parseEther } = utils

describe("BanModule", () => {
    const [creator, member0, joinPartAgent, ...others] = provider.getWallets()

    let testToken: TestToken
    let dataUnionAdmin: DataUnionSidechain
    let dataUnionAgent: DataUnionSidechain
    let mockAMB: MockAMB
    let mockTokenMediator: MockTokenMediator

    let banModuleAdmin: BanModule

    before(async () => {
        testToken = await deployContract(creator, TestTokenJson, ["name", "symbol"]) as TestToken
        await testToken.mint(creator.address, parseEther("10000"))

        mockAMB = await deployContract(creator, MockAMBJson, []) as MockAMB
        mockTokenMediator = await deployContract(creator, MockTokenMediatorJson, [testToken.address, mockAMB.address]) as MockTokenMediator

        dataUnionAdmin = await deployContract(creator, DataUnionSidechainJson, []) as DataUnionSidechain
        dataUnionAgent = dataUnionAdmin.connect(joinPartAgent)

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
        await dataUnionAdmin.initialize(
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
        log("DataUnionSidechain %s initialized", dataUnionAdmin.address)

        banModuleAdmin = await deployContract(creator, BanModuleJson, [dataUnionAdmin.address]) as BanModule
        await dataUnionAdmin.addJoinListener(banModuleAdmin.address)
        await dataUnionAdmin.addJoinPartAgent(banModuleAdmin.address)
        log("BanModule %s set up successfully", banModuleAdmin.address)

        await dataUnionAdmin.addJoinPartAgent(joinPartAgent.address)
        await dataUnionAgent.addMember(member0.address)
        log("Member %s was added to data union", member0.address)
    })

    it("doesn't let previously banned members re-join", async () => {
        const m = others[0].address
        await expect(dataUnionAgent.addMember(m)).to.emit(dataUnionAdmin, "MemberJoined")
        await expect(banModuleAdmin.ban(m)).to.emit(banModuleAdmin, "MemberBanned")
        expect(await dataUnionAdmin.isMember(m)).to.equal(false)
        await expect(dataUnionAgent.addMember(m)).to.be.revertedWith("error_memberBanned")
    })

    it("allows previously banned members to be restored", async () => {
        const m = others[1].address
        await expect(banModuleAdmin.ban(m)).to.emit(banModuleAdmin, "MemberBanned")
        await expect(banModuleAdmin.restore(m)).to.emit(banModuleAdmin, "BanRemoved")
        expect(await dataUnionAdmin.isMember(m)).to.equal(true)
    })

    it("allows previously banned members to re-join after the ban period runs out", async () => {
        const m = others[2].address
        await expect(banModuleAdmin.banSeconds(m, "1000")).to.emit(banModuleAdmin, "MemberBanned")
        await expect(dataUnionAgent.addMember(m)).to.be.revertedWith("error_memberBanned")
        await provider.send("evm_increaseTime", [100])
        await provider.send("evm_mine", [])
        await expect(dataUnionAgent.addMember(m)).to.be.revertedWith("error_memberBanned")
        await provider.send("evm_increaseTime", [1000])
        await provider.send("evm_mine", [])
        await expect(dataUnionAgent.addMember(m)).to.emit(dataUnionAdmin, "MemberJoined")
    })
})