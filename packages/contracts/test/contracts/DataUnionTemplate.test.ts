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
    let dataUnion: DataUnionTemplate
    let dataUnionFromAgent: DataUnionTemplate
    let dataUnionFromMember0: DataUnionTemplate

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
        dataUnion = await deployContract(admin, DataUnionTemplateJson, []) as DataUnionTemplate
        dataUnionFromAgent = dataUnion.connect(agents[1])
        dataUnionFromMember0 = dataUnion.connect(members[0])

        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address[] memory initialJoinPartAgents,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     address protocolFeeOracleAddress,
        //     string calldata metadataJsonString
        // )
        await dataUnion.initialize(
            admin.address,
            testToken.address,
            a,
            "1",
            parseEther("0.09"), // total fees are 1% + 9% = 10%
            feeOracle.address,
            "{}"
        )
        await dataUnionFromAgent.addMembers(m)

        log(`DataUnionTemplate initialized at ${dataUnion.address}`)
    })

    it("distributes earnings correctly", async () => {
        const randomOutsider = others[1]
        const newMember = others[0]

        // send and distribute a batch of revenue to members
        await expect(testToken.transfer(dataUnion.address, "3000")).to.emit(testToken, "Transfer(address,address,uint256)")
        await expect(dataUnion.connect(randomOutsider).refreshRevenue()).to.emit(dataUnion, "RevenueReceived")

        // repeating it should do nothing (also not throw)
        await dataUnion.connect(randomOutsider).refreshRevenue()

        expect(await dataUnion.totalEarnings()).to.equal(2700)
        expect(await dataUnion.totalAdminFees()).to.equal(270)
        expect(await dataUnion.getEarnings(admin.address)).to.equal(270)
        expect(await dataUnion.totalProtocolFees()).to.equal(30)
        expect(await dataUnion.getEarnings(dao.address)).to.equal(30)
        expect(await dataUnion.getEarnings(m[0])).to.equal(900)
        expect(await dataUnion.getEarnings(m[1])).to.equal(900)
        expect(await dataUnion.getEarnings(m[2])).to.equal(900)

        // drop a member, send more tokens, check accounting
        await expect(dataUnionFromAgent.partMember(m[0])).to.emit(dataUnion, "MemberParted")
        expect(await dataUnion.getEarnings(m[0])).to.equal(900)
        await testToken.transfer(dataUnion.address, "2000")
        await dataUnion.connect(randomOutsider).refreshRevenue()
        expect(await dataUnion.totalEarnings()).to.equal(4500)
        expect(await dataUnion.totalAdminFees()).to.equal(450)
        expect(await dataUnion.getEarnings(admin.address)).to.equal(450)
        expect(await dataUnion.totalProtocolFees()).to.equal(50)
        expect(await dataUnion.getEarnings(dao.address)).to.equal(50)
        expect(await dataUnion.getEarnings(m[0])).to.equal(900)
        expect(await dataUnion.getEarnings(m[1])).to.equal(1800)
        expect(await dataUnion.getEarnings(m[2])).to.equal(1800)
        await expect(dataUnionFromAgent.addMember(m[0])).to.emit(dataUnion, "MemberJoined")

        // add a member, send tokens, check accounting
        await expect(dataUnionFromAgent.addMember(newMember.address)).to.emit(dataUnion, "MemberJoined")
        await testToken.transfer(dataUnion.address, "4000")
        await dataUnion.connect(randomOutsider).refreshRevenue()
        expect(await dataUnion.totalEarnings()).to.equal(8100)
        expect(await dataUnion.totalAdminFees()).to.equal(810)
        expect(await dataUnion.getEarnings(admin.address)).to.equal(810)
        expect(await dataUnion.totalProtocolFees()).to.equal(90)
        expect(await dataUnion.getEarnings(dao.address)).to.equal(90)
        expect(await dataUnion.getEarnings(newMember.address)).to.equal(900)
        expect(await dataUnion.getEarnings(m[0])).to.equal(1800)
        expect(await dataUnion.getEarnings(m[1])).to.equal(2700)
        expect(await dataUnion.getEarnings(m[2])).to.equal(2700)
        await expect(dataUnionFromAgent.partMember(newMember.address)).to.emit(dataUnion, "MemberParted")
    })

    it("addMembers partMembers", async function () {
        this.timeout(1000000)
        const memberCountBeforeBN = await dataUnion.activeMemberCount()
        expect(memberCountBeforeBN).to.equal(members.length)

        // add all "others" to data union
        await expect(dataUnion.addMembers(o)).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionFromAgent.addMembers(o)).to.emit(dataUnion, "MemberJoined")
        await expect(dataUnionFromAgent.addMembers(o)).to.be.revertedWith("error_alreadyMember")
        const memberCountAfterJoinBN = await dataUnion.activeMemberCount()
        expect(+memberCountBeforeBN + others.length).to.equal(memberCountAfterJoinBN)
        expect(await dataUnion.inactiveMemberCount()).to.equal(0)

        // part all "others" from data union
        await expect(dataUnion.partMembers(o)).to.be.revertedWith("error_notPermitted")
        await expect(dataUnion.connect(others[0]).partMember(o[0])).to.emit(dataUnion, "MemberParted")
        await expect(dataUnionFromAgent.partMembers(o)).to.be.revertedWith("error_notActiveMember") // even one non-existing makes the whole tx fail
        await expect(dataUnionFromAgent.partMembers(o.slice(1))).to.emit(dataUnion, "MemberParted")
        const memberCountAfterPartBN = await dataUnion.activeMemberCount()
        expect(memberCountBeforeBN).to.equal(memberCountAfterPartBN)
        expect(await dataUnion.inactiveMemberCount()).to.equal(others.length)

        //re-add and check that inactiveMemberCount decreased
        await expect(dataUnionFromAgent.addMembers(o)).to.emit(dataUnion, "MemberJoined")
        expect(await dataUnion.inactiveMemberCount()).to.equal(0)
    })

    it("addJoinPartAgent removeJoinPartAgent", async () => {
        const newAgent = others[0]
        const newMember = others[1]
        const agentCountBeforeBN = await dataUnion.joinPartAgentCount()
        expect(agentCountBeforeBN).to.equal(agents.length)

        // add new agent
        await expect(dataUnion.connect(newAgent).addMember(newMember.address)).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnion.addJoinPartAgent(newAgent.address)).to.emit(dataUnion, "JoinPartAgentAdded")
        await expect(dataUnion.addJoinPartAgent(newAgent.address)).to.be.revertedWith("error_alreadyActiveAgent")
        const agentCountAfterAddBN = await dataUnion.joinPartAgentCount()
        expect(agentCountAfterAddBN).to.equal(agents.length + 1)
        await expect(dataUnionFromAgent.addMember(newMember.address)).to.emit(dataUnion, "MemberJoined")
        await expect(dataUnionFromAgent.partMember(newMember.address)).to.emit(dataUnion, "MemberParted")

        // remove the new agent
        await expect(dataUnion.removeJoinPartAgent(newAgent.address)).to.emit(dataUnion, "JoinPartAgentRemoved")
        await expect(dataUnion.removeJoinPartAgent(newAgent.address)).to.be.revertedWith("error_notActiveAgent")
        const agentCountAfterRemoveBN = await dataUnion.joinPartAgentCount()
        expect(agentCountAfterRemoveBN).to.equal(agents.length)
        await expect(dataUnion.connect(newAgent).addMember(newMember.address)).to.be.revertedWith("error_onlyJoinPartAgent")
    })

    it("getEarnings", async () => {
        await expect(dataUnion.getEarnings(o[0])).to.be.revertedWith("error_notMember")
        await expect(dataUnion.getEarnings(a[0])).to.be.revertedWith("error_notMember")
        await expect(dataUnion.getEarnings(admin.address)).to.be.revertedWith("error_notMember")
        expect(await dataUnion.getEarnings(m[0])).to.equal(0)

        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()

        expect(await dataUnion.getEarnings(m[0])).to.equal(900)
        expect(await dataUnion.getEarnings(m[1])).to.equal(900)
        expect(await dataUnion.getEarnings(m[2])).to.equal(900)
        expect(await dataUnion.getEarnings(admin.address)).to.equal(270)
        expect(await dataUnion.getEarnings(dao.address)).to.equal(30)
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
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()
        await expect(dataUnion.withdrawMembers(m, false)).to.emit(dataUnion, "EarningsWithdrawn")
        expect(await getBalanceIncrements(m, balances)).to.deep.equal([ 900, 900, 900 ])
    })

    it("withdrawAll", async () => {
        const balances = await getBalances(m)
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()
        await expect(dataUnion.connect(others[0]).withdrawAll(m[0], false)).to.be.revertedWith("error_notPermitted")
        await expect(dataUnionFromMember0.withdrawAll(m[0], false)).to.emit(dataUnion, "EarningsWithdrawn")
        await expect(dataUnion.withdrawAll(m[1], false)).to.emit(dataUnion, "EarningsWithdrawn")
        await dataUnion.withdrawAll(m[1], false)    // this should do nothing, also not revert
        expect(await getBalanceIncrements(m, balances)).to.deep.equal([ 900, 900, 0 ])
    })

    it("withdrawAllTo", async () => {
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()

        const before = await testToken.balanceOf(o[0])
        await expect(dataUnionFromMember0.withdrawAllTo(o[0], false)).to.emit(dataUnion, "EarningsWithdrawn")
        const after = await testToken.balanceOf(o[0])

        const diff = after.sub(before)
        expect(diff).to.equal(900)
    })

    it("withdrawToSigned", async () => {
        const recipient = others[2]
        const dataUnionFromRecipient = await dataUnion.connect(recipient)
        const r = recipient.address
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()

        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        const signature = await getWithdrawSignature(members[1], recipient, "100", dataUnion)
        assert(await dataUnion.signatureIsValid(m[1], r, "100", signature), "Contract says: bad signature")

        await expect(dataUnionFromRecipient.withdrawToSigned(m[1], o[1], "100", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionFromRecipient.withdrawToSigned(m[1], r, "1000", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionFromRecipient.withdrawToSigned(m[0], r, "100", false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionFromRecipient.withdrawToSigned(m[1], r, "100", false, signature)).to.emit(dataUnion, "EarningsWithdrawn")

        expect(await testToken.balanceOf(r)).to.equal(100)
    })

    it("withdrawAllToSigned", async () => {
        const recipient = others[3]
        const dataUnionFromRecipient = await dataUnion.connect(recipient)
        const r = recipient.address
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()

        const signature = await getWithdrawSignature(members[1], recipient, "0", dataUnion)
        // function signatureIsValid(address signer, address recipient, uint amount, bytes memory signature)
        assert(await dataUnion.signatureIsValid(m[1], r, "0", signature), "Contract says: bad signature")

        await expect(dataUnionFromRecipient.withdrawAllToSigned(m[1], o[1], false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionFromRecipient.withdrawAllToSigned(m[0], r, false, signature)).to.be.revertedWith("error_badSignature")
        await expect(dataUnionFromRecipient.withdrawAllToSigned(m[1], r, false, signature)).to.emit(dataUnion, "EarningsWithdrawn")

        expect(await testToken.balanceOf(r)).to.equal(900)
    })

    it("transferToMemberInContract", async () => {
        await testToken.approve(dataUnion.address, "2000")
        await dataUnion.connect(dao).transferToMemberInContract(o[0], "1000")
        await dataUnion.connect(dao).transferToMemberInContract(m[0], "1000")
        expect(await dataUnion.getWithdrawableEarnings(o[0])).to.equal(1000)
        expect(await dataUnion.getWithdrawableEarnings(m[0])).to.equal(1000)

        // TestToken blocks transfers with this magic amount
        await expect(dataUnion.transferToMemberInContract(m[0], "666")).to.be.revertedWith("error_transfer")

        // TestToken sabotages transfers with this magic amount
        await expect(dataUnion.transferToMemberInContract(m[0], "777")).to.be.revertedWith("error_transfer")
    })

    it("transferToMemberInContract using ERC677", async () => {
        await testToken.transferAndCall(dataUnion.address, "1000", o[0])
        await testToken.transferAndCall(dataUnion.address, "1000", m[0])
        expect(await dataUnion.getWithdrawableEarnings(o[0])).to.equal(1000)
        expect(await dataUnion.getWithdrawableEarnings(m[0])).to.equal(1000)
    })

    it("refreshes revenue when IPurchaseListener activates", async () => {
        const totalRevenueBefore = await dataUnion.totalRevenue()
        await testToken.transfer(dataUnion.address, "3000")
        const totalRevenueBefore2 = await dataUnion.totalRevenue()
        // function onPurchase(bytes32, address, uint256, uint256, uint256) returns (bool)
        await dataUnion.onPurchase("0x1234567812345678123456781234567812345678123456781234567812345678", o[0], "1670000000", "1000", "100")
        const totalRevenueAfter = await dataUnion.totalRevenue()

        expect(totalRevenueBefore).to.equal(totalRevenueBefore2)
        expect(totalRevenueAfter).to.equal(totalRevenueBefore2.add("3000"))
    })

    it("transferWithinContract", async () => {
        assert(await testToken.transfer(dataUnion.address, "3000"))
        await dataUnion.refreshRevenue()
        await expect(dataUnion.connect(others[0]).transferWithinContract(m[1], "100")).to.be.revertedWith("error_notMember")
        // change after sidechain fees / ETH-141: admin receives fees and so becomes an INACTIVE member by _increaseBalance
        // await expect(dataUnionSidechain.transferWithinContract(m[1], "100")).to.be.revertedWith("error_notMember")
        await expect(dataUnionFromMember0.transferWithinContract(m[1], "100")).to.emit(dataUnion, "TransferWithinContract")
        await expect(dataUnionFromMember0.transferWithinContract(o[1], "100")).to.emit(dataUnion, "TransferWithinContract")
        expect(await dataUnion.getWithdrawableEarnings(m[0])).to.equal(700)  // = 900 - 100 - 100
        expect(await dataUnion.getWithdrawableEarnings(m[1])).to.equal(1000) // = 900 + 100
        expect(await dataUnion.getWithdrawableEarnings(m[2])).to.equal(900)  // no changes
        expect(await dataUnion.getWithdrawableEarnings(o[1])).to.equal(100)
        // those who received some in-contract balance but aren't members should be marked inactive by _increaseBalance
        expect(await dataUnion.inactiveMemberCount()).to.equal(3)
        expect((await dataUnion.memberData(o[1])).status).to.equal(2)
        expect((await dataUnion.memberData(dao.address)).status).to.equal(2)
        expect((await dataUnion.memberData(admin.address)).status).to.equal(2)
    })

    it("getStats", async () => {
        // test send with transferAndCall. refreshRevenue not needed in this case
        await testToken.transferAndCall(dataUnion.address, "3000", "0x")

        await dataUnionFromMember0.withdraw(m[0], "500", false)
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
        ] = await dataUnion.getStats()
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
        await testToken.transfer(dataUnion.address, "3000")

        // TestToken blocks transfers with this magic amount
        await expect(dataUnionFromMember0.withdraw(m[0], "100", true)).to.be.revertedWith("error_sendToMainnetDeprecated")
    })

    it("fails to withdraw more than earnings", async () => {
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()
        await expect(dataUnionFromMember0.withdraw(m[0], "4000", false)).to.be.revertedWith("error_insufficientBalance")

        // TestToken blocks transfers with this magic amount
        await expect(dataUnionFromMember0.withdraw(m[0], "666", false)).to.be.revertedWith("error_transfer")
    })

    it("fails to initialize twice", async () => {
        const a = agents.map(agent => agent.address)
        await expect(dataUnion.initialize(
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
        await testToken.transfer(dataUnion.address, "3000")
        await dataUnion.refreshRevenue()

        const signature = await getWithdrawSignature(members[1], recipient, "100", dataUnion)
        const truncatedSig = signature.slice(0, -10)
        const badVersionSig = signature.slice(0, -2) + "30"

        await expect(dataUnion.withdrawToSigned(m[1], r, "100", false, truncatedSig)).to.be.revertedWith("error_badSignatureLength")
        await expect(dataUnion.withdrawToSigned(m[1], r, "100", false, badVersionSig)).to.be.revertedWith("error_badSignatureVersion")
        await expect(dataUnion.withdrawToSigned(m[1], r, "200", false, signature)).to.be.revertedWith("error_badSignature")

        await expect(dataUnion.signatureIsValid(m[1], r, "100", truncatedSig)).to.be.revertedWith("error_badSignatureLength")
        await expect(dataUnion.signatureIsValid(m[1], r, "100", badVersionSig)).to.be.revertedWith("error_badSignatureVersion")
        assert(!await dataUnion.signatureIsValid(m[1], r, "200", signature), "Bad signature was accepted as valid :(")
    })

    it("can transfer ownership", async () => {
        await expect(dataUnion.connect(others[0]).transferOwnership(o[0])).to.be.revertedWith("error_onlyOwner")
        await expect(dataUnion.connect(others[0]).claimOwnership()).to.be.revertedWith("error_onlyPendingOwner")

        await dataUnion.transferOwnership(o[0])
        await expect(dataUnion.connect(others[0]).claimOwnership()).to.emit(dataUnion, "OwnershipTransferred")
        expect(await dataUnion.owner()).to.equal(o[0])

        await expect(dataUnion.transferOwnership(o[0])).to.be.revertedWith("error_onlyOwner")
        await dataUnion.connect(others[0]).transferOwnership(admin.address)
        await expect(dataUnion.claimOwnership()).to.emit(dataUnion, "OwnershipTransferred")
        expect(await dataUnion.owner()).to.equal(admin.address)
    })

    it("rejects unexpected ERC677 tokens", async () => {
        const randomToken = await deployContract(admin, TestTokenJson, ["random", "RND"]) as TestToken
        await randomToken.mint(admin.address, parseEther("10000"))
        await expect(randomToken.transferAndCall(dataUnion.address, "1000", "0x")).to.be.revertedWith("error_onlyTokenContract")
    })

    it("rejects admin fee that would cause total fees sum above 1.0", async () => {
        await expect(dataUnion.setAdminFee(parseEther("0.995"))).to.be.revertedWith("error_adminFee")
    })

    it("adjusts an admin fee that would cause total fees sum above 1.0", async () => {
        await expect(dataUnion.setAdminFee(parseEther("0.9"))).to.emit(dataUnion, "AdminFeeChanged")
        expect(await dataUnion.adminFeeFraction()).to.equal(parseEther("0.9"))
        await feeOracle.setFee(parseEther("0.2"))
        assert(await testToken.transfer(dataUnion.address, "3000"))
        await dataUnion.refreshRevenue()
        expect(await dataUnion.adminFeeFraction()).to.equal(parseEther("0.8"))
        await feeOracle.setFee(parseEther("0.01"))
    })

    it("lets only admin change the metadata", async () => {
        await expect(dataUnion.connect(members[0]).setMetadata("foo")).to.be.revertedWith("error_onlyOwner")
        expect(await dataUnion.metadataJsonString()).to.equal("{}")
        await expect(dataUnion.connect(admin).setMetadata("foo")).to.emit(dataUnion, "MetadataChanged")
        expect(await dataUnion.metadataJsonString()).to.equal("foo")
    })

    it("lets only admin change the admin fee", async () => {
        await expect(dataUnion.connect(members[0]).setAdminFee(parseEther("0.5"))).to.be.revertedWith("error_onlyOwner")
        expect(await dataUnion.adminFeeFraction()).to.equal(parseEther("0.09"))
        await expect(dataUnion.connect(admin).setAdminFee(parseEther("0.5"))).to.emit(dataUnion, "AdminFeeChanged")
        expect(await dataUnion.adminFeeFraction()).to.equal(parseEther("0.5"))
    })

    it("cannot swap modules after locking", async () => {
        const dummyAddress = "0x1234567890123456789012345678901234567890"
        await expect(dataUnion.setWithdrawModule(dummyAddress)).to.emit(dataUnion, "WithdrawModuleChanged")
        await expect(dataUnion.addJoinListener(dummyAddress)).to.emit(dataUnion, "JoinListenerAdded")
        await expect(dataUnion.addPartListener(dummyAddress)).to.emit(dataUnion, "PartListenerAdded")
        await expect(dataUnion.removeJoinListener(dummyAddress)).to.emit(dataUnion, "JoinListenerRemoved")
        await expect(dataUnion.removePartListener(dummyAddress)).to.emit(dataUnion, "PartListenerRemoved")
        await dataUnion.lockModules()
        await expect(dataUnion.setWithdrawModule(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnion.addJoinListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnion.addPartListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnion.removeJoinListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
        await expect(dataUnion.removePartListener(dummyAddress)).to.be.revertedWith("error_modulesLocked")
    })

    it("lets only joinPartAgent set weights", async () => {
        await expect(dataUnion.setMemberWeight(m[0], parseEther("1"))).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnion.setMemberWeights(m, ["1", "2", "3"])).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionFromMember0.setMemberWeight(m[0], parseEther("1"))).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionFromMember0.setMemberWeights(m, ["1", "2", "3"])).to.be.revertedWith("error_onlyJoinPartAgent")
        await expect(dataUnionFromAgent.setMemberWeight(m[0], parseEther("2"))).to.emit(dataUnion, "MemberWeightChanged")
        await expect(dataUnionFromAgent.setMemberWeights(m, ["1", "2", "3"])).to.emit(dataUnion, "MemberWeightChanged")
    })

    it("calculates revenue correctly after weights are changed", async () => {
        expect(await dataUnion.totalWeight()).to.equal(parseEther("3"))
        await testToken.transferAndCall(dataUnion.address, parseEther("10"), "0x")
        expect(await dataUnion.totalEarnings()).to.equal(parseEther("9")) // 10 - 1 (=10% fees)
        expect(await dataUnion.getEarnings(m[0])).to.equal(parseEther("3"))
        expect(await dataUnion.getEarnings(m[1])).to.equal(parseEther("3"))
        expect(await dataUnion.getEarnings(m[2])).to.equal(parseEther("3"))

        // ...even when the weights are scaled in a funny way (not using parseEther)
        await expect(dataUnionFromAgent.setMemberWeights(m, ["1", "2", "3"])).to.emit(dataUnion, "MemberWeightChanged")
        expect(await dataUnion.totalWeight()).to.equal("6")
        await testToken.transferAndCall(dataUnion.address, parseEther("20"), "0x")
        expect(await dataUnion.totalEarnings()).to.equal(parseEther("27")) // 9 + 20 - 2 (=10% fees)
        expect(await dataUnion.getEarnings(m[0])).to.equal(parseEther("6"))  // 3 + 3 (=1/6 of 18)
        expect(await dataUnion.getEarnings(m[1])).to.equal(parseEther("9"))  // 3 + 6 (=2/6 of 18)
        expect(await dataUnion.getEarnings(m[2])).to.equal(parseEther("12")) // 3 + 9 (=3/6 of 18)

        // scale more "normally" using parseEther
        await expect(dataUnionFromAgent.setMemberWeights(m, [parseEther("3"), parseEther("2"), parseEther("1")])).to.emit(dataUnion, "MemberWeightChanged")
        expect(await dataUnion.totalWeight()).to.equal(parseEther("6"))
        await testToken.transferAndCall(dataUnion.address, parseEther("20"), "0x")
        expect(await dataUnion.totalEarnings()).to.equal(parseEther("45")) // 27 + 20 - 2 (=10% fees)
        expect(await dataUnion.getEarnings(m[0])).to.equal(parseEther("15")) // 6 + 12 (=3/6 of 18)
        expect(await dataUnion.getEarnings(m[1])).to.equal(parseEther("15")) // 9 + 9  (=2/6 of 18)
        expect(await dataUnion.getEarnings(m[2])).to.equal(parseEther("15")) // 12 + 6 (=1/6 of 18)
    })

    it("addMemberWithWeight", async () => {
        const newMember = others[0].address
        await expect(dataUnionFromAgent.addMemberWithWeight(m[0], parseEther("1"))).to.be.revertedWith("error_alreadyMember")
        await expect(dataUnionFromAgent.addMemberWithWeight(newMember, parseEther("0"))).to.be.revertedWith("error_zeroWeight")

        expect(await dataUnion.memberWeight(newMember)).to.equal(0)
        await expect(dataUnionFromAgent.addMemberWithWeight(newMember, parseEther("3"))).to.emit(dataUnion, "MemberJoined")
        expect(await dataUnion.memberWeight(newMember)).to.equal(parseEther("3"))

        await expect(dataUnionFromAgent.addMemberWithWeight(newMember, parseEther("1"))).to.be.revertedWith("error_alreadyMember")

        await expect(dataUnionFromAgent.partMember(newMember)).to.emit(dataUnion, "MemberParted")
        expect(await dataUnion.memberWeight(newMember)).to.equal(0)
    })

    it("addMembersWithWeights", async function () {
        this.timeout(1000000)
        await expect(dataUnionFromAgent.addMembersWithWeights(m, ["1", "2", "3"])).to.be.revertedWith("error_alreadyMember")
        await expect(dataUnionFromAgent.addMembersWithWeights(o.slice(0, 3), [parseEther("0"), parseEther("4"), parseEther("5")]))
            .to.be.revertedWith("error_zeroWeight")

        expect(await dataUnion.memberWeight(o[0])).to.equal(0)
        await expect(dataUnionFromAgent.addMembersWithWeights(o.slice(0, 3), [parseEther("3"), parseEther("4"), parseEther("5")]))
            .to.emit(dataUnion, "MemberJoined")
        expect(await dataUnion.memberWeight(o[0])).to.equal(parseEther("3"))

        await expect(dataUnionFromAgent.addMembersWithWeights(o.slice(0, 1), [parseEther("1")])).to.be.revertedWith("error_alreadyMember")

        await expect(dataUnionFromAgent.partMembers(o.slice(0, 3))).to.emit(dataUnion, "MemberParted")
        expect(await dataUnion.memberWeight(o[0])).to.equal(0)
    })

    it("can add and remove members with setMemberWeights", async () => {
        await expect(dataUnionFromAgent.setMemberWeights([m[0], m[1], o[0]], [parseEther("0"), parseEther("2"), parseEther("2")]))
            .to.emit(dataUnion, "MemberJoined")
            .and.to.emit(dataUnion, "MemberWeightChanged")
            .and.to.emit(dataUnion, "MemberParted")
        expect(await dataUnion.isMember(m[0])).to.equal(false)
        expect(await dataUnion.isMember(m[1])).to.equal(true)
        expect(await dataUnion.isMember(o[0])).to.equal(true)
        expect(await dataUnion.isMember(o[1])).to.equal(false)
    })
})
