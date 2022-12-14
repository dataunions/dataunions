import { expect, use } from "chai"
import { waffle } from "hardhat"
import { BigNumber, utils } from "ethers"

import Debug from "debug"
const log = Debug("Streamr:du:test:WeightTokenModule")
// const log = console.log  // for debugging?

import DataUnionJson from "../../artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json"
import DefaultFeeOracleJson from "../../artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json"
import WeightTokenModuleJson from "../../artifacts/contracts/modules/WeightTokenModule.sol/WeightTokenModule.json"

import TestTokenJson from "../../artifacts/contracts/test/TestToken.sol/TestToken.json"

import type { WeightTokenModule, DefaultFeeOracle, DataUnionTemplate as DataUnion, TestToken } from "../../typechain"

// type EthereumAddress = string

use(waffle.solidity)
const { deployContract, provider } = waffle
const { parseEther } = utils

describe("WeightTokenModule", () => {
    const [dao, admin, agent, member0, member1, ...others] = provider.getWallets()

    let testToken: TestToken
    let feeOracle: DefaultFeeOracle

    before(async () => {
        testToken = await deployContract(dao, TestTokenJson, ["name", "symbol"]) as TestToken
        await testToken.mint(dao.address, parseEther("10000"))

        feeOracle = await deployContract(dao, DefaultFeeOracleJson, []) as DefaultFeeOracle
        await feeOracle.initialize(parseEther("0.01"), dao.address)
    })

    async function deployDataUnion() {
        const dataUnion = await deployContract(admin, DataUnionJson, []) as DataUnion
        const dataUnionFromAgent = dataUnion.connect(agent)

        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address[] memory initialJoinPartAgents,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     address protocolFeeOracleAddress,
        //     string calldata initialMetadataJsonString
        // )
        await dataUnion.initialize(
            admin.address,
            testToken.address,
            [],
            "1",
            parseEther("0.09"),
            feeOracle.address,
            "{}",
        )
        await dataUnion.addJoinPartAgent(agent.address)
        log("DataUnion %s initialized", dataUnion.address)

        const module = await deployContract(admin, WeightTokenModuleJson, [
            dataUnion.address, "test weight token", "W"
        ]) as WeightTokenModule
        await dataUnion.setMemberWeightModule(module.address)
        log("WeightTokenModule %s set up successfully", module.address)

        return {
            dataUnion,
            dataUnionFromAgent,
            module,
        }
    }

    it("allocates revenue correctly", async () => {
        const { dataUnion, dataUnionFromAgent, module: weightToken } = await deployDataUnion()
        await dataUnionFromAgent.addMember(member0.address)

        expect(await dataUnion.totalWeight()).to.equal(0)
        await weightToken.mint(member0.address, parseEther("1"))
        expect(await dataUnion.totalWeight()).to.equal(parseEther("1"))

        expect(await dataUnion.getEarnings(member0.address)).to.equal(0)
        await testToken.transferAndCall(dataUnion.address, parseEther("100"), "0x")
        expect(await dataUnion.getEarnings(member0.address)).to.equal(parseEther("90")) // 100 - 10% fee

        await dataUnionFromAgent.addMember(member1.address)
        await weightToken.mint(member1.address, parseEther("2"))
        expect(await dataUnion.totalWeight()).to.equal(parseEther("3"))

        expect(await dataUnion.getEarnings(member1.address)).to.equal(0)
        await testToken.transferAndCall(dataUnion.address, parseEther("100"), "0x")
        expect(await dataUnion.getEarnings(member0.address)).to.equal(parseEther("120")) // 90 + 30 (1/3 of 90)
        expect(await dataUnion.getEarnings(member1.address)).to.equal(parseEther("60"))  // 60 (2/3 of 90)
    })

    it("allocates revenue correctly after transfer", async () => {
        const { dataUnion, dataUnionFromAgent, module: weightToken } = await deployDataUnion()
        await dataUnionFromAgent.addMember(member0.address)
        await dataUnionFromAgent.addMember(member1.address)
        await weightToken.mint(member0.address, parseEther("1"))
        await weightToken.mint(member1.address, parseEther("2"))

        await testToken.transferAndCall(dataUnion.address, parseEther("100"), "0x")
        expect(await dataUnion.getEarnings(member0.address)).to.equal(parseEther("30")) // 1/3 of 90 = 100 - 10% fee
        expect(await dataUnion.getEarnings(member1.address)).to.equal(parseEther("60")) // 2/3 of 90

        await weightToken.connect(member1).transfer(member0.address, parseEther("1"))

        await testToken.transferAndCall(dataUnion.address, parseEther("100"), "0x")
        expect(await dataUnion.getEarnings(member0.address)).to.equal(parseEther("90"))
        expect(await dataUnion.getEarnings(member1.address)).to.equal(parseEther("90"))
    })
})
