import { assert, expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, Wallet, Contract, utils, BigNumberish } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:DataUnionTemplate")
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

    it.skip("Only accepts sorted shares and equal length arrays", async () => {
        let shares = [parseEther("0.5"), parseEther("0.1"), parseEther("0.4")]
        console.log(m)
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

    it("distributes earnings correctly", async () => {
        const randomOutsider = others[1]
        const newMember = others[0]

        // send and distribute a batch of revenue to members
        await expect(
            testToken.transfer(paymentHandler.address, "1000")
        ).to.emit(testToken, "Transfer(address,address,uint256)")

        const shares = [parseEther("0.1"), parseEther("0.4"), parseEther("0.5")]
        console.log("in test it is", testToken.address)
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
})
