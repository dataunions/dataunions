const Web3 = require("web3")
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const BN = require("bn.js")
const w3 = new Web3(web3.currentProvider)
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const DataUnionFactorySidechain = artifacts.require("./DataUnionFactorySidechain.sol")
const ERC20Mintable = artifacts.require("./ERC20Mintable.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")

/**
 * in Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.
 * web3.eth.encodeParameters() encodes addresses padded as 32bytes, so it can't be used
 * encodePacked() method from library would be preferable, but this works
 *
 * @param {EthereumAddress} to
 * @param {number} amount tokens multiplied by 10^18
 * @param {EthereumAddress} du_address
 * @param {number} from_withdrawn amount of token-wei withdrawn previously
 */
function withdrawMessage(to, amount, du_address, from_withdrawn) {
    const message = to + amount.toString(16, 64) + du_address.slice(2) + from_withdrawn.toString(16, 64)
    return message
}

contract("DataUnionSidechain", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, accounts.length / 3)
    const members = accounts.slice(accounts.length / 3, 2 * accounts.length / 3)
    const unused = accounts.slice(2 * accounts.length / 3)
    let testToken, dataUnionSidechain, mockAMB, mockTokenMediator, factory

    const amtEth = 100
    const amtWei = new BN(w3.utils.toWei(amtEth.toString()), 10)
    //earnings from test transfers
    const earn1 = amtWei.div(new BN(members.length))
    const earn2 = amtWei.div(new BN(members.length - 1))
    const earn3 = amtWei.div(new BN(members.length + 1))

    const newMemberEth = w3.utils.toWei("0.1")

    before(async () => {
        testToken = await ERC20Mintable.new("name","symbol",{ from: creator })
        mockAMB = await MockAMB.new({from: creator})
        mockTokenMediator = await MockTokenMediator.new(testToken.address, mockAMB.address, {from: creator})
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        factory = await DataUnionFactorySidechain.new(mockTokenMediator.address, dataUnionSidechain.address, {from: creator})
    
        //last arg (mainnet contract) is dummy
        await dataUnionSidechain.initialize(creator, testToken.address, agents, mockTokenMediator.address, agents[0], newMemberEth, {from: creator})
        await testToken.mint(creator, w3.utils.toWei("10000"), { from: creator })
        await dataUnionSidechain.addMembers(members, {from: agents[1]})
       
        /*
        console.log(`creator: ${creator}`)
        console.log(`agents: ${JSON.stringify(agents)}`)
        console.log(`members: ${JSON.stringify(members)}`)
        console.log(`unused: ${JSON.stringify(unused)}`)
        */
    }),
    describe("Basic Functions", () => {
        it("sidechain ETH flow", async () => {
            const ownerEth = w3.utils.toWei("0.01")
            const newDUEth = w3.utils.toWei("1")

            await assertFails(factory.setNewDUInitialEth(newMemberEth, {from: unused[0]}))
            await assertFails(factory.setNewDUOwnerInitialEth(newMemberEth, {from: unused[0]}))
            await assertFails(factory.setNewMemberInitialEth(newMemberEth, {from: unused[0]}))
            assertEvent(await factory.setNewDUInitialEth(newDUEth, {from: creator}), "UpdateNewDUInitialEth")
            assertEvent(await factory.setNewDUOwnerInitialEth(ownerEth, {from: creator}), "UpdateNewDUOwnerInitialEth")
            assertEvent(await factory.setNewMemberInitialEth(newMemberEth, {from: creator}), "UpdateDefaultNewMemberInitialEth")


            await w3.eth.sendTransaction({from:unused[0], to:factory.address, value:w3.utils.toWei("2")})

            let balBefore = +(await w3.eth.getBalance(creator))
            //const deploy = await factory.deployNewDUSidechain(creator, agents, {from: creator}).encode
            const deploy = await factory.contract.methods.deployNewDUSidechain(creator, agents).encodeABI()
            //console.log(`deply: ${deploy}`)
            await mockAMB.requireToPassMessage(factory.address, deploy, 2000000, {from: unused[0]})
            const newdu_address = await factory.sidechainAddress(unused[0])
            const newdu = await DataUnionSidechain.at(newdu_address)

            //check created DU Eth
            assertEqual(+(await w3.eth.getBalance(newdu_address)), newDUEth)

            //check owner eth
            let balAfter = +(await w3.eth.getBalance(creator))
            //console.log(`newdu_address: ${JSON.stringify(newdu_address)}   ${balBefore}  ${balAfter}`)
            assertEqual(balAfter - balBefore, ownerEth)
           
            //check member eth
            balBefore = +(await w3.eth.getBalance(members[0]))
            assertEvent(await newdu.addMembers(members, {from: agents[0]}), "MemberJoined")
            //first added member should have been given newMemberEth
            balAfter = +(await w3.eth.getBalance(members[0]))
            assertEqual(balAfter - balBefore, newMemberEth)

            //change the setting from within DU. check member Eth
            const newEth = w3.utils.toWei("0.2")
            await assertFails(newdu.setNewMemberEth(newEth, {from: unused[0]}))
            assertEvent(await newdu.setNewMemberEth(newEth, {from: creator}), "UpdateNewMemberEth")
            balBefore = +(await w3.eth.getBalance(unused[0]))
            assertEvent(await newdu.addMembers(unused.slice(0,1), {from: agents[0]}), "MemberJoined")
            //first added member should have been given newMemberEth
            balAfter = +(await w3.eth.getBalance(unused[0]))
            assertEqual(balAfter - balBefore, newEth)
        }),
        it("add/remove members", async () => {
            const initial_member_count  = +(await dataUnionSidechain.activeMemberCount())
            assertEqual(initial_member_count, members.length)
            await assertFails(dataUnionSidechain.addMembers(unused, {from: creator}))

            assertEvent(await dataUnionSidechain.addMembers(unused, {from: agents[0]}), "MemberJoined")

            var member_count = await dataUnionSidechain.activeMemberCount()
            assertEqual(initial_member_count + unused.length, member_count)

            assertEvent(await dataUnionSidechain.partMembers(unused, {from: agents[0]}), "MemberParted")
            member_count = await dataUnionSidechain.activeMemberCount()
            assertEqual(initial_member_count, member_count)
        }),

        it("add/remove joinPartAgents", async () => {
            //add agent
            await assertFails(dataUnionSidechain.addMember(unused[1], {from: unused[0]}))
            var jpCount = +(await dataUnionSidechain.joinPartAgentCount())
            assertEqual(jpCount, agents.length)
            assertEvent(await dataUnionSidechain.addJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentAdded")
            jpCount = +(await dataUnionSidechain.joinPartAgentCount())
            assertEqual(jpCount, agents.length + 1)
            assertEvent(await dataUnionSidechain.addMember(unused[1], {from: agents[0]}), "MemberJoined")
            assertEvent(await dataUnionSidechain.partMember(unused[1], {from: agents[0]}), "MemberParted")

            //remove agent
            assertEvent(await dataUnionSidechain.removeJoinPartAgent(unused[0], {from: creator}), "JoinPartAgentRemoved")
            await assertFails(dataUnionSidechain.addMember(unused[1], {from: unused[0]}))
            jpCount = +(await dataUnionSidechain.joinPartAgentCount())
            assertEqual(jpCount, agents.length)


        }),

        it("distributes earnings correctly", async () => {
            //send revenue to members[]
            assert(await testToken.transfer(dataUnionSidechain.address, amtWei))
            await dataUnionSidechain.addRevenue({from: unused[1]})
            //should do nothing:
            await dataUnionSidechain.addRevenue({from: unused[1]})

            assertEqual(+(await dataUnionSidechain.totalEarnings()), amtWei)
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
            const validWithdrawRequest = withdrawMessage(unused[2], member1earnings, dataUnionSidechain.address, member1withdrawn)
            const sig = await w3.eth.sign(validWithdrawRequest, members[1])
            //console.log(`sig ${sig}   req ${validWithdrawRequest}`)

            assert(await dataUnionSidechain.signatureIsValid(members[1], unused[2], member1earnings, sig), "Contract says: bad signature")
            // signed for recipient unused[2] not unused[1]
            await assertFails(dataUnionSidechain.withdrawAllToSigned(members[1], unused[1], false, sig, {from: unused[2]}), "error_badSignature")
            assertEvent(await dataUnionSidechain.withdrawAllToSigned(members[1], unused[2], false, sig, {from: unused[2]}), "EarningsWithdrawn")
            assertEqual(+(await testToken.balanceOf(unused[2])), member1earnings)

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
