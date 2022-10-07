import { assert, expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, Wallet, Contract, utils, BigNumberish } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:DataUnionTemplate")
//const log = console.log  // for debugging?

import DataUnionTemplateJson from "../../artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json"
import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"
import FeeOracleJson from "../../artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json"

import type { DataUnionTemplate, TestToken, DefaultFeeOracle } from "../../typechain"

type EthereumAddress = string

use(waffle.solidity)
const { deployContract, provider } = waffle
const { hexZeroPad, parseEther, arrayify } = utils

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
 * @param {number} amountTokenWei tokens multiplied by 10^18, or zero for unlimited (withdrawAllToSigned)
 * @param {Contract} duContract DataUnionTemplate contract object
 * @param {number} previouslyWithdrawn (optional) amount of token-wei withdrawn at the moment this signature is used
 */
async function getWithdrawSignature(
    signer: Wallet,
    to: Wallet,
    amountTokenWei: BigNumberish,
    duContract: Contract
) {
    const previouslyWithdrawn = await duContract.getWithdrawn(signer.address) as BigNumber
    const message = to.address
        + hexZeroPad(BigNumber.from(amountTokenWei).toHexString(), 32).slice(2)
        + duContract.address.slice(2)
        + hexZeroPad(previouslyWithdrawn.toHexString(), 32).slice(2)
    return signer.signMessage(arrayify(message))
}

describe("DataUnionTemplate", () => {
    const accounts = provider.getWallets()
    const dao = accounts[0]
    const admin = accounts[1]
    const agents = accounts.slice(2, 4)
    const members = accounts.slice(4, 7)
    const others = accounts.slice(7)

    const m = members.map(member => member.address)
    const a = agents.map(agent => agent.address)
    const o = others.map(outsider => outsider.address)

    let testToken: TestToken
    let feeOracle: DefaultFeeOracle
    let dataUnionSidechain: DataUnionTemplate
    let dataUnionSidechainAgent: DataUnionTemplate
    let dataUnionSidechainMember0: DataUnionTemplate

    before(async () => {
        testToken = await deployContract(dao, TestTokenJson, ["name", "symbol"]) as TestToken
        await testToken.mint(dao.address, parseEther("100000"))
        feeOracle = await deployContract(dao, FeeOracleJson) as DefaultFeeOracle
        await feeOracle.initialize(parseEther("0.01"), dao.address)

        log("List of relevant addresses:")
        log("  testToken: %s", testToken.address)
        log("  dao: %s", dao.address)
        log("  admin: %s", admin.address)
        log("  agents: %o", a)
        log("  members: %o", m)
        log("  outsider addresses used in tests: %o", o)
    })

    beforeEach(async () => {
        dataUnionSidechain = await deployContract(admin, DataUnionTemplateJson, []) as DataUnionTemplate
        dataUnionSidechainAgent = dataUnionSidechain.connect(agents[1])
        dataUnionSidechainMember0 = dataUnionSidechain.connect(members[0])

        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address[] memory initialJoinPartAgents,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     address protocolFeeOracleAddress,
        //     string calldata metadataJsonString
        // )
        await dataUnionSidechain.initialize(
            admin.address,
            testToken.address,
            a,
            "1",
            parseEther("0.09"), // total fees are 1% + 9% = 10%
            feeOracle.address,
            "{}"
        )
        await dataUnionSidechainAgent.addMembers(m)

        log(`DataUnionTemplate initialized at ${dataUnionSidechain.address}`)
    })

    it("distributes earnings correctly", async () => {
        const randomOutsider = others[1]
        const newMember = others[0]

        // send and distribute a batch of revenue to members
        await expect(testToken.transfer(dataUnionSidechain.address, "3000")).to.emit(testToken, "Transfer(address,address,uint256)")
        await expect(dataUnionSidechain.connect(randomOutsider).refreshRevenue()).to.emit(dataUnionSidechain, "RevenueReceived")

        // repeating it should do nothing (also not throw)
        await dataUnionSidechain.connect(randomOutsider).refreshRevenue()

        expect(await dataUnionSidechain.totalEarnings()).to.equal(2700)
        expect(await dataUnionSidechain.totalAdminFees()).to.equal(270)
        expect(await dataUnionSidechain.getEarnings(admin.address)).to.equal(270)
        expect(await dataUnionSidechain.totalProtocolFees()).to.equal(30)
        expect(await dataUnionSidechain.getEarnings(dao.address)).to.equal(30)
        expect(await dataUnionSidechain.getEarnings(m[1])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[1])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[2])).to.equal(900)

        // drop a member, send more tokens, check accounting
        await expect(dataUnionSidechainAgent.partMember(m[0])).to.emit(dataUnionSidechain, "MemberParted")
        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(900)
        await testToken.transfer(dataUnionSidechain.address, "2000")
        await dataUnionSidechain.connect(randomOutsider).refreshRevenue()
        expect(await dataUnionSidechain.totalEarnings()).to.equal(4500)
        expect(await dataUnionSidechain.totalAdminFees()).to.equal(450)
        expect(await dataUnionSidechain.getEarnings(admin.address)).to.equal(450)
        expect(await dataUnionSidechain.totalProtocolFees()).to.equal(50)
        expect(await dataUnionSidechain.getEarnings(dao.address)).to.equal(50)
        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[1])).to.equal(1800)
        expect(await dataUnionSidechain.getEarnings(m[2])).to.equal(1800)
        await expect(dataUnionSidechainAgent.addMember(m[0])).to.emit(dataUnionSidechain, "MemberJoined")

        // add a member, send tokens, check accounting
        await expect(dataUnionSidechainAgent.addMember(newMember.address)).to.emit(dataUnionSidechain, "MemberJoined")
        await testToken.transfer(dataUnionSidechain.address, "4000")
        await dataUnionSidechain.connect(randomOutsider).refreshRevenue()
        expect(await dataUnionSidechain.totalEarnings()).to.equal(8100)
        expect(await dataUnionSidechain.totalAdminFees()).to.equal(810)
        expect(await dataUnionSidechain.getEarnings(admin.address)).to.equal(810)
        expect(await dataUnionSidechain.totalProtocolFees()).to.equal(90)
        expect(await dataUnionSidechain.getEarnings(dao.address)).to.equal(90)
        expect(await dataUnionSidechain.getEarnings(newMember.address)).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(1800)
        expect(await dataUnionSidechain.getEarnings(m[1])).to.equal(2700)
        expect(await dataUnionSidechain.getEarnings(m[2])).to.equal(2700)
        await expect(dataUnionSidechainAgent.partMember(newMember.address)).to.emit(dataUnionSidechain, "MemberParted")
    })

    it("addMembers partMembers", async () => {
        const memberCountBeforeBN = await dataUnionSidechain.activeMemberCount()
        expect(memberCountBeforeBN).to.equal(members.length)

        // add all "others" to data union
        await expect(dataUnionSidechain.addMembers(o)).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionSidechainAgent.addMembers(o)).to.emit(dataUnionSidechain, "MemberJoined")
        await expect(dataUnionSidechainAgent.addMembers(o)).to.be.revertedWith("error_alreadyMember")
        const memberCountAfterJoinBN = await dataUnionSidechain.activeMemberCount()
        expect(+memberCountBeforeBN + others.length).to.equal(memberCountAfterJoinBN)
        expect(await dataUnionSidechain.inactiveMemberCount()).to.equal(0)

        // part all "others" from data union
        await expect(dataUnionSidechain.partMembers(o)).to.be.revertedWith("error_notPermitted")
        await expect(dataUnionSidechain.connect(others[0]).partMember(o[0])).to.emit(dataUnionSidechain, "MemberParted")
        await expect(dataUnionSidechainAgent.partMembers(o)).to.be.revertedWith("error_notActiveMember") // even one non-existing makes the whole tx fail
        await expect(dataUnionSidechainAgent.partMembers(o.slice(1))).to.emit(dataUnionSidechain, "MemberParted")
        const memberCountAfterPartBN = await dataUnionSidechain.activeMemberCount()
        expect(memberCountBeforeBN).to.equal(memberCountAfterPartBN)
        expect(await dataUnionSidechain.inactiveMemberCount()).to.equal(others.length)

        //re-add and check that inactiveMemberCount decreased
        await expect(dataUnionSidechainAgent.addMembers(o)).to.emit(dataUnionSidechain, "MemberJoined")
        expect(await dataUnionSidechain.inactiveMemberCount()).to.equal(0)

    })

    it("addJoinPartAgent removeJoinPartAgent", async () => {
        const newAgent = others[0]
        const newMember = others[1]
        const agentCountBeforeBN = await dataUnionSidechain.joinPartAgentCount()
        expect(agentCountBeforeBN).to.equal(agents.length)

        // add new agent
        await expect(dataUnionSidechain.connect(newAgent).addMember(newMember.address)).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionSidechain.addJoinPartAgent(newAgent.address)).to.emit(dataUnionSidechain, "JoinPartAgentAdded")
        await expect(dataUnionSidechain.addJoinPartAgent(newAgent.address)).to.be.revertedWith("error_alreadyActiveAgent")
        const agentCountAfterAddBN = await dataUnionSidechain.joinPartAgentCount()
        expect(agentCountAfterAddBN).to.equal(agents.length + 1)
        await expect(dataUnionSidechainAgent.addMember(newMember.address)).to.emit(dataUnionSidechain, "MemberJoined")
        await expect(dataUnionSidechainAgent.partMember(newMember.address)).to.emit(dataUnionSidechain, "MemberParted")

        // remove the new agent
        await expect(dataUnionSidechain.removeJoinPartAgent(newAgent.address)).to.emit(dataUnionSidechain, "JoinPartAgentRemoved")
        await expect(dataUnionSidechain.removeJoinPartAgent(newAgent.address)).to.be.revertedWith("error_notActiveAgent")
        const agentCountAfterRemoveBN = await dataUnionSidechain.joinPartAgentCount()
        expect(agentCountAfterRemoveBN).to.equal(agents.length)
        await expect(dataUnionSidechain.connect(newAgent).addMember(newMember.address)).to.be.revertedWith("error_onlyJoinPartAgent")
    })

    it("getEarnings", async () => {
        await expect(dataUnionSidechain.getEarnings(o[0])).to.be.revertedWith("error_notMember")
        await expect(dataUnionSidechain.getEarnings(a[0])).to.be.revertedWith("error_notMember")
        await expect(dataUnionSidechain.getEarnings(admin.address)).to.be.revertedWith("error_notMember")
        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(0)

        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()

        expect(await dataUnionSidechain.getEarnings(m[0])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[1])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(m[2])).to.equal(900)
        expect(await dataUnionSidechain.getEarnings(admin.address)).to.equal(270)
        expect(await dataUnionSidechain.getEarnings(dao.address)).to.equal(30)
    })

    async function getBalances(addresses: EthereumAddress[]) {
        return Promise.all(addresses.map(a => testToken.balanceOf(a)))
    }
    async function getBalanceIncrements(addresses: EthereumAddress[], originalBalances: BigNumber[]) {
        return Promise.all(addresses.map(async (a, i) => {
            const newBalance = await testToken.balanceOf(a)
            return newBalance.sub(originalBalances[i]).toNumber()
        }))
    }

    it("withdrawMembers: batch withdraw many members", async () => {
        const balances = await getBalances(m)
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()
        await expect(dataUnionSidechain.withdrawMembers(m, false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        expect(await getBalanceIncrements(m, balances)).to.deep.equal([ 900, 900, 900 ])
    })

    it("withdrawAll", async () => {
        const balances = await getBalances(m)
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()
        await expect(dataUnionSidechain.connect(others[0]).withdrawAll(m[0], false)).to.be.revertedWith("error_notPermitted")
        await expect(dataUnionSidechainMember0.withdrawAll(m[0], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await expect(dataUnionSidechain.withdrawAll(m[1], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        await dataUnionSidechain.withdrawAll(m[1], false)    // this should do nothing, also not revert
        expect(await getBalanceIncrements(m, balances)).to.deep.equal([ 900, 900, 0 ])
    })

    it("withdrawAllTo", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()

        const before = await testToken.balanceOf(o[0])
        await expect(dataUnionSidechainMember0.withdrawAllTo(o[0], false)).to.emit(dataUnionSidechain, "EarningsWithdrawn")
        const after = await testToken.balanceOf(o[0])

        const diff = after.sub(before)
        expect(diff).to.equal(900)
    })

    it("withdrawToSigned", async () => {
        const recipient = others[2]
        const dataUnionSidechainRecipient = await dataUnionSidechain.connect(recipient)
        const r = recipient.address
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()

        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        const signature = await getWithdrawSignature(members[1], recipient, "100", dataUnionSidechain)
        assert(await dataUnionSidechain.signatureIsValid(m[1], r, "100", signature), "Contract says: bad signature")

        await expect(dataUnionSidechainRecipient.withdrawToSigned(m[1], o[1], "100", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionSidechainRecipient.withdrawToSigned(m[1], r, "1000", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionSidechainRecipient.withdrawToSigned(m[0], r, "100", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionSidechainRecipient.withdrawToSigned(m[1], r, "100", false, signature)).to.emit(dataUnionSidechain, "EarningsWithdrawn")

        expect(await testToken.balanceOf(r)).to.equal(100)
    })

    it("withdrawAllToSigned", async () => {
        const recipient = others[3]
        const dataUnionSidechainRecipient = await dataUnionSidechain.connect(recipient)
        const r = recipient.address
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()

        const signature = await getWithdrawSignature(members[1], recipient, "0", dataUnionSidechain)
        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        assert(await dataUnionSidechain.signatureIsValid(m[1], r, "0", signature), "Contract says: bad signature")

        await expect(dataUnionSidechainRecipient.withdrawAllToSigned(m[1], o[1], false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionSidechainRecipient.withdrawAllToSigned(m[0], r, false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionSidechainRecipient.withdrawAllToSigned(m[1], r, false, signature)).to.emit(dataUnionSidechain, "EarningsWithdrawn")

        expect(await testToken.balanceOf(r)).to.equal(900)
    })

    it("transferToMemberInContract", async () => {
        await testToken.approve(dataUnionSidechain.address, "2000")
        await dataUnionSidechain.connect(dao).transferToMemberInContract(o[0], "1000")
        await dataUnionSidechain.connect(dao).transferToMemberInContract(m[0], "1000")
        expect(await dataUnionSidechain.getWithdrawableEarnings(o[0])).to.equal(1000)
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(1000)

        // TestToken blocks transfers with this magic amount
        await expect(dataUnionSidechain.transferToMemberInContract(m[0], "666")).to.be.revertedWith("error_transfer")

        // TestToken sabotages transfers with this magic amount
        await expect(dataUnionSidechain.transferToMemberInContract(m[0], "777")).to.be.revertedWith("error_transfer")
    })

    it("transferToMemberInContract using ERC677", async () => {
        await testToken.transferAndCall(dataUnionSidechain.address, "1000", o[0])
        await testToken.transferAndCall(dataUnionSidechain.address, "1000", m[0])
        expect(await dataUnionSidechain.getWithdrawableEarnings(o[0])).to.equal(1000)
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(1000)
    })

    it("transferWithinContract", async () => {
        assert(await testToken.transfer(dataUnionSidechain.address, "3000"))
        await dataUnionSidechain.refreshRevenue()
        await expect(dataUnionSidechain.connect(others[0]).transferWithinContract(m[1], "100")).to.be.revertedWith("error_notMember")
        // change after sidechain fees / ETH-141: admin receives fees and so becomes an INACTIVE member by _increaseBalance
        // await expect(dataUnionSidechain.transferWithinContract(m[1], "100")).to.be.revertedWith("error_notMember")
        await expect(dataUnionSidechainMember0.transferWithinContract(m[1], "100")).to.emit(dataUnionSidechain, "TransferWithinContract")
        await expect(dataUnionSidechainMember0.transferWithinContract(o[1], "100")).to.emit(dataUnionSidechain, "TransferWithinContract")
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[0])).to.equal(700)  // = 900 - 100 - 100
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[1])).to.equal(1000) // = 900 + 100
        expect(await dataUnionSidechain.getWithdrawableEarnings(m[2])).to.equal(900)  // no changes
        expect(await dataUnionSidechain.getWithdrawableEarnings(o[1])).to.equal(100)
        // those who received some in-contract balance but aren't members should be marked inactive by _increaseBalance
        expect(await dataUnionSidechain.inactiveMemberCount()).to.equal(3)
        expect((await dataUnionSidechain.memberData(o[1])).status).to.equal(2)
        expect((await dataUnionSidechain.memberData(dao.address)).status).to.equal(2)
        expect((await dataUnionSidechain.memberData(admin.address)).status).to.equal(2)
    })

    it("getStats", async () => {
        // test send with transferAndCall. refreshRevenue not needed in this case
        await testToken.transferAndCall(dataUnionSidechain.address, "3000", "0x")

        await dataUnionSidechainMember0.withdraw(m[0], "500", false)
        const [
            totalRevenue,
            totalEarnings,
            totalAdminFees,
            totalProtocolFees,
            totalEarningsWithdrawn,
            activeMemberCount,
            inactiveMemberCount,
            lifetimeMemberEarnings,
            joinPartAgentCount
        ] = await dataUnionSidechain.getStats()
        expect(totalRevenue).to.equal(3000)
        expect(totalEarnings).to.equal(2700)
        expect(totalAdminFees).to.equal(270)
        expect(totalProtocolFees).to.equal(30)
        expect(totalEarningsWithdrawn).to.equal(500)
        expect(activeMemberCount).to.equal(3)
        expect(inactiveMemberCount).to.equal(0) // admin and dao are cleaned out of this number though they show up in the "inactiveMemberCount"
        expect(lifetimeMemberEarnings).to.equal(900)
        expect(joinPartAgentCount).to.equal(2)
    })

    // withdraw to mainnet is deprecated
    it("fails calls to withdraw to mainnet", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")

        // TestToken blocks transfers with this magic amount
        await expect(dataUnionSidechainMember0.withdraw(m[0], "100", true)).to.be.revertedWith("error_sendToMainnetDeprecated")
    })

    it("fails to withdraw more than earnings", async () => {
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()
        await expect(dataUnionSidechainMember0.withdraw(m[0], "4000", false)).to.be.revertedWith("error_insufficientBalance")

        // TestToken blocks transfers with this magic amount
        await expect(dataUnionSidechainMember0.withdraw(m[0], "666", false)).to.be.revertedWith("error_transfer")
    })

    it("fails to initialize twice", async () => {
        const a = agents.map(agent => agent.address)
        await expect(dataUnionSidechain.initialize(
            admin.address,
            testToken.address,
            a,
            "1",
            parseEther("0.1"),
            feeOracle.address,
            "{}"
        )).to.be.revertedWith("error_alreadyInitialized")
    })

    it("fails for badly formed signatures", async () => {
        const recipient = others[2]
        const r = o[2]
        await testToken.transfer(dataUnionSidechain.address, "3000")
        await dataUnionSidechain.refreshRevenue()

        const signature = await getWithdrawSignature(members[1], recipient, "100", dataUnionSidechain)
        const truncatedSig = signature.slice(0, -10)
        const badVersionSig = signature.slice(0, -2) + "30"

        await expect(dataUnionSidechain.withdrawToSigned(m[1], r, "100", false, truncatedSig)).to.be.revertedWith("error_badSignatureLength")
        await expect(dataUnionSidechain.withdrawToSigned(m[1], r, "100", false, badVersionSig)).to.be.revertedWith("error_badSignatureVersion")
        await expect(dataUnionSidechain.withdrawToSigned(m[1], r, "200", false, signature)).to.be.revertedWith("error_badSignature")

        await expect(dataUnionSidechain.signatureIsValid(m[1], r, "100", truncatedSig)).to.be.revertedWith("error_badSignatureLength")
        await expect(dataUnionSidechain.signatureIsValid(m[1], r, "100", badVersionSig)).to.be.revertedWith("error_badSignatureVersion")
        assert(!await dataUnionSidechain.signatureIsValid(m[1], r, "200", signature), "Bad signature was accepted as valid :(")
    })

    it("can transfer ownership", async () => {
        await expect(dataUnionSidechain.connect(others[0]).transferOwnership(o[0])).to.be.revertedWith("error_onlyOwner")
        await expect(dataUnionSidechain.connect(others[0]).claimOwnership()).to.be.revertedWith("error_onlyPendingOwner")

        await dataUnionSidechain.transferOwnership(o[0])
        await expect(dataUnionSidechain.connect(others[0]).claimOwnership()).to.emit(dataUnionSidechain, "OwnershipTransferred")
        expect(await dataUnionSidechain.owner()).to.equal(o[0])

        await expect(dataUnionSidechain.transferOwnership(o[0])).to.be.revertedWith("error_onlyOwner")
        await dataUnionSidechain.connect(others[0]).transferOwnership(admin.address)
        await expect(dataUnionSidechain.claimOwnership()).to.emit(dataUnionSidechain, "OwnershipTransferred")
        expect(await dataUnionSidechain.owner()).to.equal(admin.address)
    })

    it("rejects unexpected ERC677 tokens", async () => {
        const randomToken = await deployContract(admin, TestTokenJson, ["random", "RND"]) as TestToken
        await randomToken.mint(admin.address, parseEther("10000"))
        await expect(randomToken.transferAndCall(dataUnionSidechain.address, "1000", "0x")).to.be.revertedWith("error_onlyTokenContract")
    })

    it("rejects admin fee that would cause total fees sum above 1.0", async () => {
        await expect(dataUnionSidechain.setAdminFee(parseEther("0.995"))).to.be.revertedWith("error_adminFee")
    })

    it("adjusts an admin fee that would cause total fees sum above 1.0", async () => {
        await expect(dataUnionSidechain.setAdminFee(parseEther("0.9"))).to.emit(dataUnionSidechain, "AdminFeeChanged")
        expect(await dataUnionSidechain.adminFeeFraction()).to.equal(parseEther("0.9"))
        await feeOracle.setFee(parseEther("0.2"))
        assert(await testToken.transfer(dataUnionSidechain.address, "3000"))
        await dataUnionSidechain.refreshRevenue()
        expect(await dataUnionSidechain.adminFeeFraction()).to.equal(parseEther("0.8"))
    })

    it("lets only admin change the metadata", async () => {
        await expect(dataUnionSidechain.connect(members[0]).setMetadata("foo")).to.be.revertedWith("error_onlyOwner")
        expect(await dataUnionSidechain.metadataJsonString()).to.equal("{}")
        await expect(dataUnionSidechain.connect(admin).setMetadata("foo")).to.emit(dataUnionSidechain, "MetadataChanged")
        expect(await dataUnionSidechain.metadataJsonString()).to.equal("foo")
    })

    it("lets only admin change the admin fee", async () => {
        await expect(dataUnionSidechain.connect(members[0]).setAdminFee(parseEther("0.5"))).to.be.revertedWith("error_onlyOwner")
        expect(await dataUnionSidechain.adminFeeFraction()).to.equal(parseEther("0.09"))
        await expect(dataUnionSidechain.connect(admin).setAdminFee(parseEther("0.5"))).to.emit(dataUnionSidechain, "AdminFeeChanged")
        expect(await dataUnionSidechain.adminFeeFraction()).to.equal(parseEther("0.5"))
    })

    it("cannot swap modules after locking", async () => {
        const dummyAddress = "0x1234567890123456789012345678901234567890"
        await expect(dataUnionSidechain.setWithdrawModule(dummyAddress)).to.emit(dataUnionSidechain, "WithdrawModuleChanged")
        await expect(dataUnionSidechain.addJoinListener(dummyAddress)).to.emit(dataUnionSidechain, "JoinListenerAdded")
        await expect(dataUnionSidechain.addPartListener(dummyAddress)).to.emit(dataUnionSidechain, "PartListenerAdded")
        await expect(dataUnionSidechain.removeJoinListener(dummyAddress)).to.emit(dataUnionSidechain, "JoinListenerRemoved")
        await expect(dataUnionSidechain.removePartListener(dummyAddress)).to.emit(dataUnionSidechain, "PartListenerRemoved")
        await dataUnionSidechain.lockModules()
        await expect(dataUnionSidechain.setWithdrawModule(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnionSidechain.addJoinListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnionSidechain.addPartListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnionSidechain.removeJoinListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnionSidechain.removePartListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
    })
})
