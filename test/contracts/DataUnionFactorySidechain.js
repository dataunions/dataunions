const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const { toWei } = web3.utils

const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const DataUnionFactorySidechain = artifacts.require("./DataUnionFactorySidechain.sol")
const TestToken = artifacts.require("./TestToken.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")
const SidechainMigrationManager = artifacts.require("./SidechainMigrationManager.sol")
const zeroAddress = "0x0000000000000000000000000000000000000000"

contract("DataUnionFactorySidechain", async accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)

    const newMemberEth = toWei("0.1")
    let testToken, dataUnionSidechain, mockAMB, mockTokenMediator, factory, migrationManager

    before(async () => {
        testToken = await TestToken.new("name","symbol",{ from: creator })
        mockAMB = await MockAMB.new({from: creator})
        mockTokenMediator = await MockTokenMediator.new(testToken.address, mockAMB.address, {from: creator})
        migrationManager = await SidechainMigrationManager.new(testToken.address, zeroAddress, mockTokenMediator.address, { from: creator })
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        factory = await DataUnionFactorySidechain.new(migrationManager.address, dataUnionSidechain.address, {from: creator})
    })
    it("sidechain ETH flow", async () => {
        const ownerEth = toWei("0.01")
        const newDUEth = toWei("1")

        await assertFails(factory.setNewDUInitialEth(newMemberEth, {from: others[0]}))
        await assertFails(factory.setNewDUOwnerInitialEth(newMemberEth, {from: others[0]}))
        await assertFails(factory.setNewMemberInitialEth(newMemberEth, {from: others[0]}))
        assertEvent(await factory.setNewDUInitialEth(newDUEth, {from: creator}), "UpdateNewDUInitialEth")
        assertEvent(await factory.setNewDUOwnerInitialEth(ownerEth, {from: creator}), "UpdateNewDUOwnerInitialEth")
        assertEvent(await factory.setNewMemberInitialEth(newMemberEth, {from: creator}), "UpdateDefaultNewMemberInitialEth")


        await web3.eth.sendTransaction({from:others[0], to:factory.address, value:web3.utils.toWei("2")})

        //this should fail because deployNewDUSidechain must be called by AMB
        await assertFails(factory.deployNewDUSidechain(creator, agents, {from: others[0]}))

        let balBefore = +(await web3.eth.getBalance(creator))
        const deploy = await factory.contract.methods.deployNewDUSidechain(creator, agents).encodeABI()
        //console.log(`deply: ${deploy}`)
        await mockAMB.requireToPassMessage(factory.address, deploy, 2000000, {from: others[0]})
        const newdu_address = await factory.sidechainAddress(others[0])
        const newdu = await DataUnionSidechain.at(newdu_address)

        //check created DU Eth
        assertEqual(+(await web3.eth.getBalance(newdu_address)), newDUEth)

        //check owner eth
        let balAfter = +(await web3.eth.getBalance(creator))
        //console.log(`newdu_address: ${JSON.stringify(newdu_address)}   ${balBefore}  ${balAfter}`)
        assertEqual(balAfter - balBefore, ownerEth)

        //check member eth
        balBefore = +(await web3.eth.getBalance(members[0]))
        assertEvent(await newdu.addMembers(members, {from: agents[0]}), "MemberJoined")
        //first added member should have been given newMemberEth
        balAfter = +(await web3.eth.getBalance(members[0]))
        assertEqual(balAfter - balBefore, newMemberEth)

        //change the setting from within DU. check member Eth
        const newEth = web3.utils.toWei("0.2")
        await assertFails(newdu.setNewMemberEth(newEth, {from: others[0]}))
        assertEvent(await newdu.setNewMemberEth(newEth, {from: creator}), "UpdateNewMemberEth")
        balBefore = +(await web3.eth.getBalance(others[0]))
        assertEvent(await newdu.addMembers(others.slice(0,1), {from: agents[0]}), "MemberJoined")
        //first added member should have been given newMemberEth
        balAfter = +(await web3.eth.getBalance(others[0]))
        assertEqual(balAfter - balBefore, newEth)
    })
})