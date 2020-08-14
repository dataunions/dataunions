const Web3 = require("web3")
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const BN = require('bn.js');
const { Wallet } = require("ethers");
const w3 = new Web3(web3.currentProvider)
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const ERC20Mintable = artifacts.require("./ERC20Mintable.sol")

const day = 86400

/*
in Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.

web3.eth.encodeParameters() encodes addresses padded as 32bytes

encodePacked() method from library would be preferable, but this works
*/
function withdrawMessage(to, amount, du_address, from_withdrawn){
    const message = to + amount.toString(16, 64) + du_address.slice(2) + from_withdrawn.toString(16, 64)
    return message
}

contract("DataUnionSidechain", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, accounts.length/3)
    const members = accounts.slice(accounts.length/3, 2*accounts.length/3)
    const unused = accounts.slice(2*accounts.length/3)
    let testToken, dataUnionSidechain;
    const adminFeeFraction = 0.1
    const adminFeeFractionWei = w3.utils.toWei(adminFeeFraction.toString())

    const amtEth = 100
    const adminFeeEth = Math.floor(amtEth*adminFeeFraction)
    const amtWei = new BN(w3.utils.toWei(amtEth.toString()), 10)
    const adminFeeWei = new BN(w3.utils.toWei(adminFeeEth.toString()), 10)
    //earnings from test transfers
    const earn1 = amtWei.sub(adminFeeWei).div(new BN(members.length))
    const earn2 = amtWei.sub(adminFeeWei).div(new BN(members.length -1))
    const earn3 = amtWei.sub(adminFeeWei).div(new BN(members.length +1))

/*
 function initialize(
        address token_address,
        uint256 adminFeeFraction_,
        address[] memory agents,
        address _token_mediator,
        address _mainchain_DU
    )
*/
    before(async () => {
        testToken = await ERC20Mintable.new("name","symbol",{ from: creator })

        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        //last 2 args are dummy. doesnt talk to mainnet contract in test
        await dataUnionSidechain.initialize(creator, testToken.address, adminFeeFractionWei, agents,agents[0],agents[0], {from: creator})
        await testToken.mint(creator, w3.utils.toWei("10000"), { from: creator })
        await dataUnionSidechain.addMembers(members, {from: agents[1]})
        console.log(`creator: ${creator}`)
        console.log(`agents: ${JSON.stringify(agents)}`)
        console.log(`members: ${JSON.stringify(members)}`)
        console.log(`unused: ${JSON.stringify(unused)}`)
    }),
    describe("Basic Functions", () => {
        it("add/remove members", async () => {
            const initial_member_count  = +(await dataUnionSidechain.active_members())
            assertEqual(initial_member_count, members.length)
            await assertFails(dataUnionSidechain.addMembers(unused, {from: creator}))

            assertEvent(await dataUnionSidechain.addMembers(unused, {from: agents[0]}), "MemberJoined")
            var member_count = await dataUnionSidechain.active_members()
            assertEqual(initial_member_count + unused.length, member_count)

            assertEvent(await dataUnionSidechain.partMembers(unused, {from: agents[0]}), "MemberParted")
            member_count = await dataUnionSidechain.active_members()
            assertEqual(initial_member_count, member_count)
        }),

        it("add/remove joinPartAgents", async () => {
            //add agent
            await assertFails(dataUnionSidechain.addMember(unused[1], {from: unused[0]}))
            var jpCount = +(await dataUnionSidechain.join_part_agent_count());
            assertEqual(jpCount, agents.length)
            assertEvent(await dataUnionSidechain.addJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentAdded")
            jpCount = +(await dataUnionSidechain.join_part_agent_count());
            assertEqual(jpCount, agents.length + 1)
            assertEvent(await dataUnionSidechain.addMember(unused[1], {from: agents[0]}), "MemberJoined")
            assertEvent(await dataUnionSidechain.partMember(unused[1], {from: agents[0]}), "MemberParted")

            //remove agent
            assertEvent(await dataUnionSidechain.removeJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentRemoved")
            await assertFails(dataUnionSidechain.addMember(unused[1], {from: unused[0]}))
            jpCount = +(await dataUnionSidechain.join_part_agent_count());
            assertEqual(jpCount, agents.length)


        }),

        it("distributes revenue correctly", async () => {
            //send revenue to members[]
            assert(await testToken.transfer(dataUnionSidechain.address, amtWei))
            await dataUnionSidechain.addRevenue({from: unused[1]})
            //should do nothing:
            await dataUnionSidechain.addRevenue({from: unused[1]})

            assertEqual(+(await dataUnionSidechain.totalAdminFees()), adminFeeWei)
            assertEqual(+(await dataUnionSidechain.totalRevenue()), amtWei)
            assertEqual(+(await dataUnionSidechain.getEarnings(members[0])), earn1)

            //drop a member, send tokens, check accounting
            assertEvent(await dataUnionSidechain.partMember(members[0], {from: agents[0]}), "MemberParted")
            assertEqual(+(await dataUnionSidechain.getEarnings(members[0])), earn1)
            assert(await testToken.transfer(dataUnionSidechain.address,amtWei))
            await dataUnionSidechain.addRevenue({from: unused[1]})
            assertEqual(+(await dataUnionSidechain.getEarnings(members[0])), earn1)
            assertEqual(+(await dataUnionSidechain.getEarnings(members[1])), earn1.add(earn2))
            assertEvent(await dataUnionSidechain.addMember(members[0], {from: agents[0]}), "MemberJoined")

            //add a member, send tokens, check accounting
            assertEvent(await dataUnionSidechain.addMember(unused[0], {from: agents[0]}), "MemberJoined")
            assert(await testToken.transfer(dataUnionSidechain.address, amtWei))
            await dataUnionSidechain.addRevenue({from: unused[1]})
            assertEqual(+(await dataUnionSidechain.getEarnings(unused[0])), earn3)
            assertEqual(+(await dataUnionSidechain.getEarnings(members[1])), earn1.add(earn2).add(earn3))
            assertEqual(+(await dataUnionSidechain.getEarnings(members[0])), earn1.add(earn3))
            assertEvent(await dataUnionSidechain.partMember(unused[0], {from: agents[0]}), "MemberParted")
        }),
        it("withdrawal works", async () => {
            //test withdaw to self
            await assertFails(dataUnionSidechain.withdrawAll(unused[0], false, {from: unused[1]}))
            assertEvent(await dataUnionSidechain.withdrawAll(unused[0], false, {from: unused[0]}), "EarningsWithdrawn")
            assertEqual(+(await testToken.balanceOf(unused[0])), earn3)

            //test withdraw to other
            assertEvent(await dataUnionSidechain.withdrawAllTo(unused[0], false, {from: members[0]}), "EarningsWithdrawn")
            assertEqual(+(await testToken.balanceOf(unused[0])), earn3.add(earn1.add(earn3)))

            //test signed withdraw
            const member1earnings = earn1.add(earn2).add(earn3)
            const member1withdrawn =  new BN(0)
            const validWithdrawRequest = withdrawMessage(unused[2], member1earnings, dataUnionSidechain.address, member1withdrawn);
            const sig = await w3.eth.sign(validWithdrawRequest, members[1])
            //console.log(`sig ${sig}   req ${validWithdrawRequest}`)

            assert(await dataUnionSidechain.signatureIsValid(members[1], unused[2], member1earnings, sig), "Contract says: bad signature")
            // signed for recipient unused[2] not unused[1]
            await assertFails(dataUnionSidechain.withdrawAllToSigned(members[1], unused[1], false, sig, {from: unused[2]}), "error_badSignature")
            assertEvent(await dataUnionSidechain.withdrawAllToSigned(members[1], unused[2], false, sig, {from: unused[2]}), "EarningsWithdrawn")
            assertEqual(+(await testToken.balanceOf(unused[2])), member1earnings)

            // test admin fee withdraw
            const ownerTokenBefore = await testToken.balanceOf(creator);
            //no access
            await assertFails(dataUnionSidechain.withdrawAdminFees(false, {from: unused[1]}))

            assertEvent(await dataUnionSidechain.withdrawAdminFees(false, {from: creator}), "AdminFeesWithdrawn")
            //should do nothing:
            await dataUnionSidechain.withdrawAdminFees(false,{from: creator})
            const ownerTokenAfter = await testToken.balanceOf(creator);
            assertEqual(ownerTokenAfter.sub(ownerTokenBefore), adminFeeWei.mul(new BN(3)))
        })
    }),
    describe("In-Contract Transfers", () => {
        it("can transfer tokens to member in-contract", async () => {
            await testToken.approve(dataUnionSidechain.address, amtWei, {from: creator})
            await dataUnionSidechain.transferToMemberInContract(unused[0], amtWei, {from: creator})
            let bal = await dataUnionSidechain.getWithdrawableEarnings(unused[0])
            assertEqual(bal, amtWei)
        }),
        it("members can send intra-contract", async () => {
            assert(await testToken.transfer(dataUnionSidechain.address, amtWei))
            await dataUnionSidechain.addRevenue({from: unused[1]})
            const amt = new BN(w3.utils.toWei("1"), 10)
            await dataUnionSidechain.transferWithinContract(unused[1], amt, {from: members[0]})
            let bal = await dataUnionSidechain.getWithdrawableEarnings(unused[1])
            assertEqual(bal, amt)
        })
    })
})
