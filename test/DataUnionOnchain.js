const Web3 = require("web3")
const { assertEqual, assertFails, assertEvent } = require("./utils/web3Assert")
const BN = require('bn.js');
const w3 = new Web3(web3.currentProvider)
const DataUnionOnchain = artifacts.require("./DataUnionOnchain.sol")
const ERC20Mintable = artifacts.require("./ERC20Mintable.sol")

const day = 86400

contract("DataUnionOnchain", accounts => {
    const creator = accounts[0]

    const agents = accounts.slice(1, accounts.length/3)
    const members = accounts.slice(accounts.length/3, 2*accounts.length/3)
    const unused = accounts.slice(2*accounts.length/3)
    let testToken, dataUnionOnchain;
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


    before(async () => {
        testToken = await ERC20Mintable.new("name","symbol",{ from: creator })
        dataUnionOnchain = await DataUnionOnchain.new(testToken.address, adminFeeFractionWei, agents, {from: creator})
        await testToken.mint(creator, w3.utils.toWei("10000"), { from: creator })
        await dataUnionOnchain.addMembers(members, {from: agents[1]})
        console.log(`creator: ${creator}`)
        console.log(`agents: ${JSON.stringify(agents)}`)
        console.log(`members: ${JSON.stringify(members)}`)
        console.log(`unused: ${JSON.stringify(unused)}`)
    }),
    describe("Test1", () => {
        it("add/remove members", async () => {
            const initial_member_count  = +(await dataUnionOnchain.active_members())
            assertEqual(initial_member_count, members.length)
            await assertFails(dataUnionOnchain.addMembers(unused, {from: creator}))

            assertEvent(await dataUnionOnchain.addMembers(unused, {from: agents[0]}), "MemberJoined")
            var member_count = await dataUnionOnchain.active_members()
            assertEqual(initial_member_count + unused.length, member_count)

            assertEvent(await dataUnionOnchain.partMembers(unused, {from: agents[0]}), "MemberParted")
            member_count = await dataUnionOnchain.active_members()
            assertEqual(initial_member_count, member_count)
        }),

        it("add/remove joinPartAgents", async () => {
            //add agent
            await assertFails(dataUnionOnchain.addMember(unused[1], {from: unused[0]}))          
            var jpCount = +(await dataUnionOnchain.join_part_agent_count());
            assertEqual(jpCount, agents.length)
            assertEvent(await dataUnionOnchain.addJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentAdded")
            jpCount = +(await dataUnionOnchain.join_part_agent_count());
            assertEqual(jpCount, agents.length + 1)
            assertEvent(await dataUnionOnchain.addMember(unused[1], {from: agents[0]}), "MemberJoined")
            assertEvent(await dataUnionOnchain.partMember(unused[1], {from: agents[0]}), "MemberParted")

            //remove agent
            assertEvent(await dataUnionOnchain.removeJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentRemoved")
            await assertFails(dataUnionOnchain.addMember(unused[1], {from: unused[0]}))          
            jpCount = +(await dataUnionOnchain.join_part_agent_count());
            assertEqual(jpCount, agents.length)
            

        }),
        
        it("revenue correctly distrubted", async () => {
            //send revenue to members[]
            assert(await testToken.transfer(dataUnionOnchain.address, amtWei))
            await dataUnionOnchain.addRevenue({from: unused[1]})
            //should do nothing:
            await dataUnionOnchain.addRevenue({from: unused[1]})

            assertEqual(+(await dataUnionOnchain.totalAdminFees()), adminFeeWei)
            assertEqual(+(await dataUnionOnchain.totalRevenue()), amtWei)
            assertEqual(+(await dataUnionOnchain.getEarnings(members[0])), earn1)
 
            //drop a member, send tokens, check accounting
            assertEvent(await dataUnionOnchain.partMember(members[0], {from: agents[0]}), "MemberParted")
            assertEqual(+(await dataUnionOnchain.getEarnings(members[0])), earn1)
            assert(await testToken.transfer(dataUnionOnchain.address,amtWei))
            await dataUnionOnchain.addRevenue({from: unused[1]})
            assertEqual(+(await dataUnionOnchain.getEarnings(members[0])), earn1)
            assertEqual(+(await dataUnionOnchain.getEarnings(members[1])), earn1.add(earn2))
            assertEvent(await dataUnionOnchain.addMember(members[0], {from: agents[0]}), "MemberJoined")

            //add a member, send tokens, check accounting 
            assertEvent(await dataUnionOnchain.addMember(unused[0], {from: agents[0]}), "MemberJoined")
            assert(await testToken.transfer(dataUnionOnchain.address, amtWei))
            await dataUnionOnchain.addRevenue({from: unused[1]})
            assertEqual(+(await dataUnionOnchain.getEarnings(unused[0])), earn3)
            assertEqual(+(await dataUnionOnchain.getEarnings(members[1])), earn1.add(earn2).add(earn3))
            assertEqual(+(await dataUnionOnchain.getEarnings(members[0])), earn1.add(earn3))
            assertEvent(await dataUnionOnchain.partMember(unused[0], {from: agents[0]}), "MemberParted")
        }),
        it("withdrawal works", async () => {
            assertEvent(await dataUnionOnchain.withdraw(unused[0], {from: unused[1]}), "EarningsWithdrawn")
            assertEvent(await dataUnionOnchain.withdraw(members[0], {from: unused[1]}), "EarningsWithdrawn")
            assertEvent(await dataUnionOnchain.withdraw(members[1], {from: unused[1]}), "EarningsWithdrawn")
            assertEqual(+(await testToken.balanceOf(unused[0])), earn3)
            assertEqual(+(await testToken.balanceOf(members[1])), earn1.add(earn2).add(earn3))
            assertEqual(+(await testToken.balanceOf(members[0])), earn1.add(earn3))

            const ownerTokenBefore = await testToken.balanceOf(creator);
            assertEvent(await dataUnionOnchain.withdrawAdminFees({from: unused[1]}), "AdminFeesWithdrawn")
            //should do nothing:
            await dataUnionOnchain.withdrawAdminFees({from: unused[1]})
            const ownerTokenAfter = await testToken.balanceOf(creator);
            assertEqual(ownerTokenAfter.sub(ownerTokenBefore), adminFeeWei.mul(new BN(3)))
        })
    })
})
