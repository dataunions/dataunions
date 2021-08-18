const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const { toWei } = web3.utils

const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const DataUnionFactorySidechain = artifacts.require("./DataUnionFactorySidechain.sol")
const TestToken = artifacts.require("./TestToken.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")

contract("DataUnionFactorySidechain", async accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)

    const newMemberEth = toWei("0.1")
    let testToken, dataUnionSidechain, mockAMB, mockTokenMediator, factory

    before(async () => {
        testToken = await TestToken.new("name", "symbol", { from: creator })
        mockAMB = await MockAMB.new({from: creator})
        mockTokenMediator = await MockTokenMediator.new(testToken.address, mockAMB.address, {from: creator})
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        factory = await DataUnionFactorySidechain.new(dataUnionSidechain.address, {from: creator})
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

        let balBefore = +(await web3.eth.getBalance(creator))

        // function deployNewDUSidechain(
        //     address token,
        //     address mediator,
        //     address payable owner,
        //     address[] memory agents,
        //     uint256 initialAdminFeeFraction,
        //     uint256 initialDataUnionFeeFraction,
        //     address initialDataUnionBeneficiary
        // )

        // this should fail because deployNewDUSidechain must be called by AMB
        await assertFails(factory.deployNewDUSidechain(
            testToken.address,
            mockTokenMediator.address,
            creator,
            agents,
            toWei("0.1"),
            toWei("0.1"),
            others[0],
            {from: others[0]})
        )

        const deployMessage = await factory.contract.methods.deployNewDUSidechain(
            testToken.address,
            mockTokenMediator.address,
            creator,
            agents,
            toWei("0.1"),
            toWei("0.1"),
            others[0]
        ).encodeABI()
        //console.log('deploy: %o', deployMessage)
        await mockAMB.requireToPassMessage(factory.address, deployMessage, 2000000, {from: others[0]})
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