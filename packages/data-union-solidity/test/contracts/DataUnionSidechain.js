const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const { BN, toWei } = w3.utils
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")

const log = require("debug")("Streamr:du:test:DataUnionSidechain")
//const log = console.log  // for debugging?

const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const TestToken = artifacts.require("./TestToken.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")

/**
 * Member can sign off to "donate" all earnings to another address such that someone else
 *   can submit the transaction (and pay for the gas)
 *
 * In Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.
 * web3.eth.encodeParameters() encodes addresses padded as 32bytes, so it can't be used
 * encodePacked() method from library would be preferable, but this works
 *
 * @param {EthereumAddress} signer who authorizes withdraw
 * @param {EthereumAddress} to who gets the tokens
 * @param {number} amount tokens multiplied by 10^18, or zero for unlimited (withdrawAllToSigned)
 * @param {Contract} duContract DataUnionSidechain contract object
 * @param {number} previouslyWithdrawn (optional) amount of token-wei withdrawn at the moment this signature is used
 */
async function getWithdrawSignature(signer, to, amount, duContract, previouslyWithdrawn) {
    const withdrawn = previouslyWithdrawn || await duContract.getWithdrawn(signer)
    const duAddress = duContract.address
    const message = to + amount.toString(16, 64) + duAddress.slice(2) + withdrawn.toString(16, 64)
    return w3.eth.sign(message, signer)
}

contract("DataUnionSidechain", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)
    let testToken, migrateToken, dataUnionSidechain, migrationManager

    beforeEach(async () => {
        /*
        function initialize(
            address initialOwner,
            address _migrationManager,
            address[] memory initialJoinPartAgents,
            address mainnetDataUnionAddress,
            uint256 defaultNewMemberEth
        ) 
        */
        testToken = await TestToken.new("name", "symbol", { from: creator })
        //mediator is a dummy non-zero address. mediator not used
        migrationManager = await SidechainMigrationManager.new(testToken.address, zeroAddress, agents[0], { from: creator })
        migrateToken = await TestToken.new("migrate", "m", { from: creator })
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        await dataUnionSidechain.initialize(creator, migrationManager.address, agents, agents[0], "1", {from: creator})
        await testToken.mint(creator, toWei("10000"), { from: creator })
        await migrateToken.mint(creator, toWei("10000"), { from: creator })
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
        await assertFails(dataUnionSidechain.addMembers(others, {from: agents[0]}), "error_alreadyMember")
        const memberCountAfterJoinBN = await dataUnionSidechain.activeMemberCount()
        assertEqual(+memberCountBeforeBN + others.length, memberCountAfterJoinBN)
        assertEqual(await dataUnionSidechain.inactiveMemberCount(), new BN(0))
        // part all "others" from data union
        await assertFails(dataUnionSidechain.partMembers(others, {from: creator}), "error_notPermitted")
        assertEvent(await dataUnionSidechain.partMembers(others, {from: agents[0]}), "MemberParted")
        await assertFails(dataUnionSidechain.partMembers(others, {from: agents[0]}), "error_notActiveMember")
        const memberCountAfterPartBN = await dataUnionSidechain.activeMemberCount()
        assertEqual(memberCountBeforeBN, memberCountAfterPartBN)
        assertEqual(await dataUnionSidechain.inactiveMemberCount(), new BN(others.length))
        //re-add and check that inactiveMemberCount decreased
        assertEvent(await dataUnionSidechain.addMembers(others, {from: agents[0]}), "MemberJoined")
        assertEqual(await dataUnionSidechain.inactiveMemberCount(), new BN(0))
        
    })

    it("addJoinPartAgent removeJoinPartAgent", async () => {
        const newAgent = others[0]
        const newMember = others[1]
        const agentCountBeforeBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountBeforeBN, agents.length)

        // add new agent
        await assertFails(dataUnionSidechain.addMember(newMember, {from: newAgent}), "error_onlyJoinPartAgent")
        assertEvent(await dataUnionSidechain.addJoinPartAgent(newAgent, {from: creator}), "JoinPartAgentAdded")
        await assertFails(dataUnionSidechain.addJoinPartAgent(newAgent, {from: creator}), "error_alreadyActiveAgent")
        const agentCountAfterAddBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountAfterAddBN, agents.length + 1)
        assertEvent(await dataUnionSidechain.addMember(newMember, {from: agents[0]}), "MemberJoined")
        assertEvent(await dataUnionSidechain.partMember(newMember, {from: agents[0]}), "MemberParted")

        // remove the new agent
        assertEvent(await dataUnionSidechain.removeJoinPartAgent(newAgent, {from: creator}), "JoinPartAgentRemoved")
        await assertFails(dataUnionSidechain.removeJoinPartAgent(newAgent, {from: creator}), "error_notActiveAgent")
        const agentCountAfterRemoveBN = await dataUnionSidechain.joinPartAgentCount()
        assertEqual(agentCountAfterRemoveBN, agents.length)
        await assertFails(dataUnionSidechain.addMember(newMember, {from: newAgent}), "error_onlyJoinPartAgent")
    })

    it("withdrawMembers: batch withdraw many members", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})
        assertEvent(await dataUnionSidechain.withdrawMembers(members, false, {from: creator}), "EarningsWithdrawn")
        assertEqual(await testToken.balanceOf(members[0]), 1000)
        assertEqual(await testToken.balanceOf(members[1]), 1000)
        assertEqual(await testToken.balanceOf(members[2]), 1000)
    })

    it("withdrawAll", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})
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
        await dataUnionSidechain.refreshRevenue({from: creator})

        const before = await testToken.balanceOf(others[0])
        assertEvent(await dataUnionSidechain.withdrawAllTo(others[0], false, {from: members[0]}), "EarningsWithdrawn")
        const after = await testToken.balanceOf(others[0])

        const diff = after.sub(before)
        assertEqual(diff, 1000)
    })

    it("withdrawToSigned", async () => {
        const recipient = others[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})

        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        const signature = await getWithdrawSignature(members[1], recipient, new BN("100"), dataUnionSidechain)
        assert(await dataUnionSidechain.signatureIsValid(members[1], recipient, "100", signature), "Contract says: bad signature")

        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], others[1], "100", false, signature, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], recipient, "1000", false, signature, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[0], recipient, "100", false, signature, {from: recipient}), "error_badSignature")
        assertEvent(await dataUnionSidechain.withdrawToSigned(members[1], recipient, "100", false, signature, {from: recipient}), "EarningsWithdrawn")

        assertEqual(await testToken.balanceOf(recipient), 100)
    })

    it("withdrawAllToSigned", async () => {
        const recipient = others[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})

        const signature = await getWithdrawSignature(members[1], recipient, new BN("0"), dataUnionSidechain)
        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        assert(await dataUnionSidechain.signatureIsValid(members[1], recipient, "0", signature), "Contract says: bad signature")

        await assertFails(dataUnionSidechain.withdrawAllToSigned(members[1], others[1], false, signature, {from: recipient}), "error_badSignature")
        await assertFails(dataUnionSidechain.withdrawAllToSigned(members[0], recipient, false, signature, {from: recipient}), "error_badSignature")
        assertEvent(await dataUnionSidechain.withdrawAllToSigned(members[1], recipient, false, signature, {from: recipient}), "EarningsWithdrawn")

        assertEqual(await testToken.balanceOf(recipient), 1000)
    })

    it("transferToMemberInContract", async () => {
        await testToken.approve(dataUnionSidechain.address, "2000", {from: creator})
        await dataUnionSidechain.transferToMemberInContract(others[0], "1000", {from: creator})
        await dataUnionSidechain.transferToMemberInContract(members[0], "1000", {from: creator})
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(others[0]), 1000)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[0]), 1000)

        // TestToken blocks transfers with this magic amount
        await assertFails(dataUnionSidechain.transferToMemberInContract(members[0], "666", {from: creator}), "error_transfer")

        // TestToken sabotages transfers with this magic amount
        await assertFails(dataUnionSidechain.transferToMemberInContract(members[0], "777", {from: creator}), "error_transfer")
    })

    it("transferWithinContract", async () => {
        assert(await testToken.transfer(dataUnionSidechain.address, "3000"))
        await dataUnionSidechain.refreshRevenue({from: others[1]})
        await assertFails(dataUnionSidechain.transferWithinContract(members[1], "100", {from: others[0]}), "error_notMember")
        await assertFails(dataUnionSidechain.transferWithinContract(members[1], "100", {from: creator}), "error_notMember")
        assertEvent(await dataUnionSidechain.transferWithinContract(members[1], "100", {from: members[0]}), "TransferWithinContract")
        assertEvent(await dataUnionSidechain.transferWithinContract(others[1], "100", {from: members[0]}), "TransferWithinContract")
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[0]), 800)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[1]), 1100)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(members[2]), 1000)
        assertEqual(await dataUnionSidechain.getWithdrawableEarnings(others[1]), 100)
        //other[1] should be status Inactive
        assertEqual(await dataUnionSidechain.inactiveMemberCount(), new BN(1))
    })

    it("getStats", async () => {
        //test send with transferAndCall. refreshRevenue not needed in this case
        await testToken.transferAndCall(dataUnionSidechain.address, "3000", [])
        await dataUnionSidechain.withdraw(members[0], "500", false, {from: members[0]})
        const [
            totalEarnings,
            totalEarningsWithdrawn,
            activeMemberCount,
            inactiveMemberCount,
            lifetimeMemberEarnings,
            joinPartAgentCount
        ] = await dataUnionSidechain.getStats()
        assertEqual(totalEarnings, 3000)
        assertEqual(totalEarningsWithdrawn, 500)
        assertEqual(activeMemberCount, 3)
        assertEqual(inactiveMemberCount, 0)
        assertEqual(lifetimeMemberEarnings, 1000)
        assertEqual(joinPartAgentCount, 2)
    })

    it("getEarnings", async () => {
        await assertFails(dataUnionSidechain.getEarnings(others[0]), "error_notMember")
        await assertFails(dataUnionSidechain.getEarnings(agents[0]), "error_notMember")
        await assertFails(dataUnionSidechain.getEarnings(creator), "error_notMember")
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 0)

        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})

        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
    })

    it("distributes earnings correctly", async () => {
        const randomOutsider = others[1]
        const newMember = others[0]

        // send and distribute a batch of revenue to members
        assertEvent(await testToken.transfer(dataUnionSidechain.address, "3000"), "Transfer")
        assertEvent(await dataUnionSidechain.refreshRevenue({from: randomOutsider}), "RevenueReceived")

        // repeating it should do nothing (also not throw)
        await dataUnionSidechain.refreshRevenue({from: randomOutsider})

        assertEqual(await dataUnionSidechain.totalEarnings(), 3000)
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[1]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[2]), 1000)

        // drop a member, send more tokens, check accounting
        assertEvent(await dataUnionSidechain.partMember(members[0], {from: agents[0]}), "MemberParted")
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        await testToken.transfer(dataUnionSidechain.address, "2000")
        await dataUnionSidechain.refreshRevenue({from: randomOutsider})
        assertEqual(await dataUnionSidechain.getEarnings(members[0]), 1000)
        assertEqual(await dataUnionSidechain.getEarnings(members[1]), 2000)
        assertEqual(await dataUnionSidechain.getEarnings(members[2]), 2000)
        assertEvent(await dataUnionSidechain.addMember(members[0], {from: agents[0]}), "MemberJoined")

        // add a member, send tokens, check accounting
        assertEvent(await dataUnionSidechain.addMember(newMember, {from: agents[0]}), "MemberJoined")
        await testToken.transfer(dataUnionSidechain.address, "4000")
        await dataUnionSidechain.refreshRevenue({from: randomOutsider})
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
        await dataUnionSidechain.refreshRevenue({from: creator})
        assertEvent(await dataUnionSidechain.withdraw(members[0], "100", true, {from: members[0]}), "EarningsWithdrawn")

        // TestToken blocks transfers with this magic amount
        await assertFails(dataUnionSidechain.withdraw(members[0], "666", true, {from: members[0]}), "error_transfer")
    })

    it("fails to withdraw more than earnings", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})
        await assertFails(dataUnionSidechain.withdraw(members[0], "4000", false, {from: members[0]}), "error_insufficientBalance")

        // TestToken blocks transfers with this magic amount
        await assertFails(dataUnionSidechain.withdraw(members[0], "666", false, {from: members[0]}), "error_transfer")
    })

    it("fails to initialize twice", async () => {
        await assertFails(dataUnionSidechain.initialize(creator, testToken.address, agents, agents[0], agents[0], {from: creator}))
    })

    it("fails for badly formed signatures", async () => {
        const recipient = others[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue({from: creator})

        const signature = await getWithdrawSignature(members[1], recipient, new BN("100"), dataUnionSidechain)
        const truncatedSig = signature.slice(0, -10)
        const badVersionSig = signature.slice(0, -2) + "30"

        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], recipient, "100", false, truncatedSig, {from: creator}), "error_badSignatureLength")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], recipient, "100", false, badVersionSig, {from: creator}), "error_badSignatureVersion")
        await assertFails(dataUnionSidechain.withdrawToSigned(members[1], recipient, "200", false, signature, {from: creator}), "error_badSignature")

        await assertFails(dataUnionSidechain.signatureIsValid(members[1], recipient, "100", truncatedSig), "error_badSignatureLength")
        await assertFails(dataUnionSidechain.signatureIsValid(members[1], recipient, "100", badVersionSig), "error_badSignatureVersion")
        assert(!await dataUnionSidechain.signatureIsValid(members[1], recipient, "200", signature), "Bad signature was accepted as valid :(")
    })

    it("can migrate token", async () => {
        const amount = 3000
        await testToken.transfer(dataUnionSidechain.address, amount.toString())
        await dataUnionSidechain.refreshRevenue({from: creator})

        await migrateToken.transfer(migrationManager.address, amount.toString())
        await migrationManager.setOldToken(testToken.address, {from: creator})
        await migrationManager.setCurrentToken(migrateToken.address, {from: creator})
        await assertFails(dataUnionSidechain.migrate({from: members[1]}))        
        assertEvent(await dataUnionSidechain.migrate({from: creator}), "MigrateToken")
        assertEqual(await testToken.balanceOf(dataUnionSidechain.address), 0)
        assertEqual(await migrateToken.balanceOf(dataUnionSidechain.address), amount)
        assertEqual(await testToken.balanceOf(migrationManager.address), amount)
        assertEqual(await migrateToken.balanceOf(migrationManager.address), 0)

        assertEvent(await dataUnionSidechain.withdrawAll(members[0], false, {from: members[0]}), "EarningsWithdrawn")
        assertEqual(await migrateToken.balanceOf(members[0]), amount / members.length)
        // agents[0] is the new dummy mediator address
        assertEqual(await dataUnionSidechain.tokenMediator(), agents[0])
    })
})
