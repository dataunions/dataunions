const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const { BN, toWei } = w3.utils
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const TestToken = artifacts.require("./TestToken.sol")

const log = require("debug")("Streamr:du:test:DataUnionSidechain")
//const log = console.log  // for debugging?

/**
 * in Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.
 * web3.eth.encodeParameters() encodes addresses padded as 32bytes, so it can't be used
 * encodePacked() method from library would be preferable, but this works
 *
 * @param {EthereumAddress} to
 * @param {number} amount tokens multiplied by 10^18, or zero for unlimited (withdrawAllToSigned)
 * @param {EthereumAddress} du_address
 * @param {number} from_withdrawn amount of token-wei withdrawn previously
 */
function withdrawMessage(to, amount, du_address, from_withdrawn) {
    const message = to + amount.toString(16, 64) + du_address.slice(2) + from_withdrawn.toString(16, 64)
    return message
}

contract("DataUnionSidechain", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)

    let testToken, dataUnionSidechain

    beforeEach(async () => {
        // Last 2 initialize args are dummy. Doesn't talk to mainnet contract in test
        // function initialize(
        //   address initialOwner,
        //   address tokenAddress,
        //   address[] memory initialJoinPartAgents,
        //   address tokenMediatorAddress,
        //   address mainnetDataUnionAddress
        // )
        testToken = await TestToken.new("name", "symbol", { from: creator })
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        await dataUnionSidechain.initialize(creator, testToken.address, agents, agents[0], agents[0], {from: creator})
        await testToken.mint(creator, toWei("10000"), { from: creator })
        await dataUnionSidechain.addMembers(members, {from: agents[1]})

        log(`DataUnionSidechain initialized at ${dataUnionSidechain.address}`)
        log(`  creator: ${creator}`)
        log(`  agents: ${JSON.stringify(agents)}`)
        log(`  members: ${JSON.stringify(members)}`)
        log(`  outsider addresses used in tests: ${JSON.stringify(others)}`)
    })

    it("addMembers partMembers", async () => {
        const memberCountBeforeBN = await dataUnionSidechain.activeMemberCount()
        assertEqual(memberCountBeforeBN, members.length)

        // add all "others" to data union
        await assertFails(dataUnionSidechain.addMembers(others, {from: creator}), "error_onlyJoinPartAgent")
        assertEvent(await dataUnionSidechain.addMembers(others, {from: agents[0]}), "MemberJoined")
        const memberCountAfterJoinBN = await dataUnionSidechain.activeMemberCount()
        assertEqual(+memberCountBeforeBN + others.length, memberCountAfterJoinBN)

        // part all "others" from data union
        assertEvent(await dataUnionSidechain.partMembers(others, {from: agents[0]}), "MemberParted")
        const memberCountAfterPartBN = await dataUnionSidechain.activeMemberCount()
        assertEqual(memberCountBeforeBN, memberCountAfterPartBN)
    })

    it("addJoinPartAgent removeJoinPartAgent", async () => {
        const newAgent = others[0]
        const newMember = others[1]
        const agentCountBeforeBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountBeforeBN, agents.length)

        // add new agent
        await assertFails(dataUnionSidechain.addMember(newMember, {from: newAgent}), "error_onlyJoinPartAgent")
        assertEvent(await dataUnionSidechain.addJoinPartAgent(newAgent, {from: creator}), "JoinPartAgentAdded")
        const agentCountAfterAddBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountAfterAddBN, agents.length + 1)
        assertEvent(await dataUnionSidechain.addMember(newMember, {from: agents[0]}), "MemberJoined")
        assertEvent(await dataUnionSidechain.partMember(newMember, {from: agents[0]}), "MemberParted")

        // remove the new agent
        assertEvent(await dataUnionSidechain.removeJoinPartAgent(newAgent, {from: creator}), "JoinPartAgentRemoved")
        const agentCountAfterRemoveBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountAfterRemoveBN, agents.length)
        await assertFails(dataUnionSidechain.addMember(newMember, {from: newAgent}), "error_onlyJoinPartAgent")
    })

    it("withdrawMembers: batch withdraw many members", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})
        assertEvent(await dataUnionSidechain.withdrawMembers(members, false, {from: creator}), "EarningsWithdrawn")
        assertEqual(await testToken.balanceOf(members[0]), 1000)
        assertEqual(await testToken.balanceOf(members[1]), 1000)
        assertEqual(await testToken.balanceOf(members[2]), 1000)
    })

    it("withdrawAll", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})
        await assertFails(dataUnionSidechain.withdrawAll(members[0], false, {from: others[0]}), "error_notPermitted")
        assertEvent(await dataUnionSidechain.withdrawAll(members[0], false, {from: members[0]}), "EarningsWithdrawn")
        assertEvent(await dataUnionSidechain.withdrawAll(members[1], false, {from: creator}), "EarningsWithdrawn")
        await dataUnionSidechain.withdrawAll(members[1], false, {from: creator})    // this should do nothing, also not revert
        assertEqual(await testToken.balanceOf(members[0]), 1000)
        assertEqual(await testToken.balanceOf(members[1]), 1000)
        assertEqual(await testToken.balanceOf(members[2]), 0)
    })

    it("withdrawAllTo", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})

        const before = await testToken.balanceOf(others[0])
        assertEvent(await dataUnionSidechain.withdrawAllTo(others[0], false, {from: members[0]}), "EarningsWithdrawn")
        const after = await testToken.balanceOf(others[0])

        const diff = after.sub(before)
        assertEqual(diff, 1000)
    })

    it("withdrawToSigned", async () => {
        const recipient = others[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})

        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        const msg = withdrawMessage(recipient, new BN("100"), dataUnionSidechain.address, new BN("0"))
        const sig = await w3.eth.sign(msg, members[1])
        assert(await dataUnionSidechain.signatureIsValid(members[1], recipient, "100", sig), "Contract says: bad signature")

        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], others[1], "100", false, sig, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], recipient, "1000", false, sig, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[0], recipient, "100", false, sig, {from: recipient}), "error_badSignature")
        assertEvent(await dataUnionSidechain.withdrawToSigned(members[1], recipient, "100", false, sig, {from: recipient}), "EarningsWithdrawn")

        assertEqual(await testToken.balanceOf(recipient), 100)
    })

    it("withdrawAllToSigned", async () => {
        const recipient = others[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})

        const msg = withdrawMessage(recipient, new BN("0"), dataUnionSidechain.address, new BN("0"))
        const sig = await w3.eth.sign(msg, members[1])
        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        assert(await dataUnionSidechain.signatureIsValid(members[1], recipient, "0", sig), "Contract says: bad signature")

        await assertFails(dataUnionSidechain.withdrawAllToSigned(members[1], others[1], false, sig, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawAllToSigned(members[0], recipient, false, sig, {from: recipient}), "error_badSignature")
        assertEvent(await dataUnionSidechain.withdrawAllToSigned(members[1], recipient, false, sig, {from: recipient}), "EarningsWithdrawn")

        assertEqual(await testToken.balanceOf(recipient), 1000)
    })

    it("transferToMemberInContract", async () => {
        await testToken.approve(dataUnionSidechain.address, "2000", {from: creator})
        await dataUnionSidechain.transferToMemberInContract(others[0], "1000", {from: creator})
        await dataUnionSidechain.transferToMemberInContract(members[0], "1000", {from: creator})
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(others[0]), 1000)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[0]), 1000)
    })

    it("transferWithinContract", async () => {
        assert(await testToken.transfer(dataUnionSidechain.address, "3000"))
        await dataUnionSidechain.addRevenue({from: others[1]})
        await assertFails(dataUnionSidechain.transferWithinContract(members[1], "100", {from: others[0]}), "error_notMember")
        await assertFails(dataUnionSidechain.transferWithinContract(members[1], "100", {from: creator}), "error_notMember")
        assertEvent(await dataUnionSidechain.transferWithinContract(members[1], "100", {from: members[0]}), "TransferWithinContract")
        assertEvent(await dataUnionSidechain.transferWithinContract(others[1], "100", {from: members[0]}), "TransferWithinContract")
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[0]), 800)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[1]), 1100)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[2]), 1000)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(others[1]), 100)
    })

    it("getStats", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})
        await dataUnionSidechain.withdraw(members[0], "500", false, {from: members[0]})
        const [
            totalEarnings,
            totalEarningsWithdrawn,
            activeMemberCount,
            lifetimeMemberEarnings,
            joinPartAgentCount
        ] = await dataUnionSidechain.getStats()
        assertEqual(totalEarnings, 3000)
        assertEqual(totalEarningsWithdrawn, 500)
        assertEqual(activeMemberCount, 3)
        assertEqual(lifetimeMemberEarnings, 1000)
        assertEqual(joinPartAgentCount, 2)
    })

    it("distributes earnings correctly", async () => {
        const randomOutsider = others[1]
        const newMember = others[0]

        // send and distribute a batch of revenue to members
        assertEvent(await testToken.transfer(dataUnionSidechain.address, "3000"), "Transfer")
        assertEvent(await dataUnionSidechain.addRevenue({from: randomOutsider}), "RevenueReceived")

        // repeating it should do nothing (also not throw)
        await dataUnionSidechain.addRevenue({from: randomOutsider})

        assertEqual(await dataUnionSidechain.totalEarnings(), 3000)
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[1]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[2]), 1000)

        // drop a member, send more tokens, check accounting
        assertEvent(await dataUnionSidechain.partMember(members[0], {from: agents[0]}), "MemberParted")
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        await testToken.transfer(dataUnionSidechain.address, "2000")
        await dataUnionSidechain.addRevenue({from: randomOutsider})
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[1]), 2000)
        assertEqual(await dataUnionSidechain.getEarnings(members[2]), 2000)
        assertEvent(await dataUnionSidechain.addMember(members[0], {from: agents[0]}), "MemberJoined")

        // add a member, send tokens, check accounting
        assertEvent(await dataUnionSidechain.addMember(newMember, {from: agents[0]}), "MemberJoined")
        await testToken.transfer(dataUnionSidechain.address, "4000")
        await dataUnionSidechain.addRevenue({from: randomOutsider})
        assertEqual(await dataUnionSidechain.getEarnings(newMember), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 2000)
        assertEqual(await dataUnionSidechain.getEarnings(members[1]), 3000)
        assertEqual(await dataUnionSidechain.getEarnings(members[2]), 3000)
        assertEvent(await dataUnionSidechain.partMember(newMember, {from: agents[0]}), "MemberParted")
    })

    // Of course there is no "withdraw to mainnet" in test.
    // Instead what happens in DataUnionSidechain is a call to TokenMediator
    it("withdraw to mainnet", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.addRevenue({from: creator})
        assertEvent(await dataUnionSidechain.withdraw(members[0], "100", true, {from: members[0]}), "EarningsWithdrawn")

        // TestToken blocks transfer with this magic amount
        await assertFails(dataUnionSidechain.withdraw(members[0], "666", true, {from: members[0]}), "error_transfer")
    })
})
