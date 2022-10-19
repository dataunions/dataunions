import { assert, expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, Wallet, Contract, utils, BigNumberish } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:PaymentHandler")
//const log = console.log  // for debugging?

import DataUnionTemplateJson from "../../artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json"
import PaymentHandlerJson from "../../artifacts/contracts/PaymentHandler.sol/PaymentHandler.json"
import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"
import FeeOracleJson from "../../artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json"

import type {
    DataUnionTemplate,
    TestToken,
    DefaultFeeOracle,
    PaymentHandler,
} from "../../typechain"

use(waffle.solidity)
const { deployContract, provider } = waffle
const { hexZeroPad, parseEther, arrayify } = utils

describe("DataUnionTemplate", () => {
    const accounts = provider.getWallets()
    const dao = accounts[0]
    const admin = accounts[1]
    const agents = accounts.slice(2, 4)
    const members = accounts.slice(4, 7)
    const others = accounts.slice(7)

    const m = members.map((member) => member.address)
    const a = agents.map((agent) => agent.address)
    const o = others.map((outsider) => outsider.address)

    let testToken: TestToken
    let feeOracle: DefaultFeeOracle
    let dataUnionSidechain: DataUnionTemplate
    let paymentHandler: PaymentHandler
    let dataUnionSidechainAgent: DataUnionTemplate
    let dataUnionSidechainMember0: DataUnionTemplate

    before(async () => {
        feeOracle = (await deployContract(
            dao,
            FeeOracleJson
        )) as DefaultFeeOracle
        await feeOracle.initialize(parseEther("0.01"), dao.address)

        log("List of relevant addresses:")
        log("  dao: %s", dao.address)
        log("  admin: %s", admin.address)
        log("  agents: %o", a)
        log("  members: %o", m)
        log("  outsider addresses used in tests: %o", o)
    })

    beforeEach(async () => {
        dataUnionSidechain = (await deployContract(
            admin,
            DataUnionTemplateJson,
            []
        )) as DataUnionTemplate

        testToken = (await deployContract(dao, TestTokenJson, [
            "name",
            "symbol",
        ])) as TestToken
        await testToken.mint(dao.address, parseEther("100000"))

        paymentHandler = (await deployContract(admin, PaymentHandlerJson, [
            dataUnionSidechain.address,
            testToken.address,
        ])) as PaymentHandler

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

        await dataUnionSidechain.addJoinPartAgent(paymentHandler.address)

        log(`DataUnionTemplate initialized at ${dataUnionSidechain.address}`)
    })

    it("Only accepts sorted shares and equal length arrays", async () => {
        let shares = [parseEther("0.5"), parseEther("0.1"), parseEther("0.4")]
        await expect(paymentHandler.distribute(m, shares)).to.be.revertedWith(
            "Array not sorted"
        )
        shares = [parseEther("0.1"), parseEther("0.5")]
        await expect(paymentHandler.distribute(m, shares)).to.be.revertedWith(
            "Array length must be equal"
        )
        shares = [parseEther("0.2"), parseEther("0.4"), parseEther("0.5")]
        await expect(paymentHandler.distribute(m, shares)).to.be.revertedWith(
            "Shares must add up to 1"
        )
        shares = [parseEther("0.1"), parseEther("0.4"), parseEther("0.5")]
        await paymentHandler.distribute(m, shares)
    })

    it("Only accepts active members", async () => {
        await dataUnionSidechainAgent.addMembers(a)
        await dataUnionSidechainAgent.addMember(o[0])
        // send and distribute a batch of revenue to members
        await expect(
            testToken.transfer(paymentHandler.address, "1000")
        ).to.emit(testToken, "Transfer(address,address,uint256)")

        const shares = [
            parseEther("0.05"),
            parseEther("0.05"),
            parseEther("0.2"),
            parseEther("0.2"),
            parseEther("0.25"),
            parseEther("0.25"),
        ]
        await expect(
            paymentHandler.distribute(m.concat(a).concat(o[1]), shares)
        ).to.be.revertedWith("Active members don't match array")
    })

    it("distributes earnings correctly", async () => {
        // send and distribute a batch of revenue to members
        await expect(
            testToken.transfer(paymentHandler.address, "1000")
        ).to.emit(testToken, "Transfer(address,address,uint256)")

        const shares = [parseEther("0.1"), parseEther("0.4"), parseEther("0.5")]
        await paymentHandler.distribute(m, shares)

        expect(await dataUnionSidechain.totalEarnings()).to.equal(900)
        expect(
            await (await dataUnionSidechain.getEarnings(m[0])).toString()
        ).to.equal("90")
        expect(
            await (await dataUnionSidechain.getEarnings(m[1])).toString()
        ).to.equal("360")
        expect(
            await (await dataUnionSidechain.getEarnings(m[2])).toString()
        ).to.equal("450")
    })
    it("distributes buckets correctly 1", async () => {
        // send and distribute a batch of revenue to members
        await expect(
            testToken.transfer(paymentHandler.address, "1000")
        ).to.emit(testToken, "Transfer(address,address,uint256)")

        const shares = [parseEther("0.1"), parseEther("0.1"), parseEther("0.8")]
        await paymentHandler.distribute(m, shares)

        expect(await dataUnionSidechain.totalEarnings()).to.equal(900)
        expect(
            await (await dataUnionSidechain.getEarnings(m[0])).toString()
        ).to.equal("90")
        expect(
            await (await dataUnionSidechain.getEarnings(m[1])).toString()
        ).to.equal("90")
        expect(
            await (await dataUnionSidechain.getEarnings(m[2])).toString()
        ).to.equal("720")
    })
    it("distributes buckets correctly 2", async () => {
        // send and distribute a batch of revenue to members
        await expect(
            testToken.transfer(paymentHandler.address, "1000")
        ).to.emit(testToken, "Transfer(address,address,uint256)")

        await dataUnionSidechainAgent.addMembers(a)
        await dataUnionSidechainAgent.addMember(o[0])

        const shares = [
            parseEther("0.05"),
            parseEther("0.05"),
            parseEther("0.2"),
            parseEther("0.2"),
            parseEther("0.25"),
            parseEther("0.25"),
        ]
        await paymentHandler.distribute(m.concat(a).concat(o[0]), shares)

        expect(await dataUnionSidechain.totalEarnings()).to.equal(900)
        expect(
            await (await dataUnionSidechain.getEarnings(m[0])).toString()
        ).to.equal("45")
        expect(
            await (await dataUnionSidechain.getEarnings(m[1])).toString()
        ).to.equal("45")
        expect(
            await (await dataUnionSidechain.getEarnings(m[2])).toString()
        ).to.equal("180")
        expect(
            await (await dataUnionSidechain.getEarnings(a[0])).toString()
        ).to.equal("180")
        expect(
            await (await dataUnionSidechain.getEarnings(a[1])).toString()
        ).to.equal("225")
        expect(
            await (await dataUnionSidechain.getEarnings(o[0])).toString()
        ).to.equal("225")

        await dataUnionSidechainAgent.partMembers(a)
    })
})
