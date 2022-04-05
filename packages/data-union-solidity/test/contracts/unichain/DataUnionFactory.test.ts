import { expect, use } from "chai"
import { waffle } from "hardhat"
import { Contract, utils, BigNumber } from "ethers"
const { parseEther } = utils

import DataUnionFactoryJson from "../../../artifacts/contracts/unichain/DataUnionFactory.sol/DataUnionFactory.json"
import DataUnionTemplateJson from "../../../artifacts/contracts/unichain/DataUnionTemplate.sol/DataUnionTemplate.json"

import TestTokenJson from "../../../artifacts/contracts/test/TestToken.sol/TestToken.json"

import { DataUnionFactory, TestToken } from "../../../typechain"

import Debug from "debug"
const log = Debug("Streamr:du:test:BinanceAdapter")

use(waffle.solidity)
const { deployContract, provider } = waffle

type EthereumAddress = string

describe("DataUnionFactory", (): void => {
    const accounts = provider.getWallets()

    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)

    const m = members.map(member => member.address)
    const o = others.map(outsider => outsider.address)

    let factory: DataUnionFactory
    let testToken: TestToken

    before(async () => {
        testToken = await deployContract(creator, TestTokenJson, ["name", "symbol"]) as TestToken
        const dataUnionSidechainTemplate = await deployContract(creator, DataUnionTemplateJson, [])
        factory = await deployContract(creator, DataUnionFactoryJson,
            [dataUnionSidechainTemplate.address, testToken.address]) as DataUnionFactory
    })

    it("sidechain ETH flow", async () => {
        const ownerEth = parseEther("0.01")
        const newDUEth = parseEther("1")
        const newMemberEth = parseEther("0.1")

        const factoryOutsider = factory.connect(others[0])
        await expect(factoryOutsider.setNewDUInitialEth(newMemberEth)).to.be.reverted
        await expect(factoryOutsider.setNewDUOwnerInitialEth(newMemberEth)).to.be.reverted
        await expect(factoryOutsider.setNewMemberInitialEth(newMemberEth)).to.be.reverted
        await expect(factory.setNewDUInitialEth(newDUEth)).to.emit(factory, "UpdateNewDUInitialEth")
        await expect(factory.setNewDUOwnerInitialEth(ownerEth)).to.emit(factory, "UpdateNewDUOwnerInitialEth")
        await expect(factory.setNewMemberInitialEth(newMemberEth)).to.emit(factory, "UpdateDefaultNewMemberInitialEth")

        await others[0].sendTransaction({
            to: factory.address,
            value: parseEther("2"),
        })

        const creatorBalanceBefore = await provider.getBalance(creator.address)

        //  function deployNewDUSidechain(
        //     address payable owner,
        //     uint256 initialAdminFeeFraction,
        //     uint256 initialDataUnionFeeFraction,
        //     address initialDataUnionBeneficiary
        //     address[] memory agents,
        //  )
        const args : [EthereumAddress, BigNumber, BigNumber, EthereumAddress, EthereumAddress[]] = [
            creator.address,
            parseEther("0.1"),
            parseEther("0.1"),
            others[0].address,
            agents.map(a => a.address),
        ]
        log("deployNewDUSidechain args: %o", args)

        const tx = await factory.deployNewDataUnion(...args)
        const tr = await tx.wait()
        const [createdEvent] = tr?.events?.filter((evt: any) => evt?.event === "DUCreated") ?? []
        if (!createdEvent || !createdEvent.args || !createdEvent.args.length) {
            throw new Error("Missing DUCreated event")
        }
        const [newDuAddress] = createdEvent?.args
        expect(tr?.events?.filter((evt: any) => evt?.event === "SidechainDUCreated") ?? []).to.have.length(1)

        log("%s code: %s", newDuAddress, await provider.getCode(newDuAddress))
        expect(await provider.getCode(newDuAddress)).not.equal("0x")

        const newDuCreator = new Contract(newDuAddress, DataUnionTemplateJson.abi, creator)
        const newDuAgent = new Contract(newDuAddress, DataUnionTemplateJson.abi, agents[0])
        const newDuOutsider = new Contract(newDuAddress, DataUnionTemplateJson.abi, others[0])
        const newDuBalance = await provider.getBalance(newDuAddress)
        log("newdu_address: %s, balance %s", newDuAddress, newDuBalance)

        // TODO: move asserts to the end

        // check created DU Eth
        expect(newDuBalance).to.equal(newDUEth)

        // check owner eth increased (can't assert exact change because creator also pays gas fees)
        const creatorBalanceChange = (await provider.getBalance(creator.address)).sub(creatorBalanceBefore)
        expect(creatorBalanceChange).not.equal(0)

        // 1st added member should have been given newMemberEth
        const balanceBefore1 = await provider.getBalance(members[0].address)
        await expect(newDuAgent.addMembers(m)).to.emit(newDuAgent, "MemberJoined")
        const balanceChange1 = (await provider.getBalance(members[0].address)).sub(balanceBefore1)
        expect(balanceChange1).to.equal(newMemberEth)

        // change the setting from within DU. check member Eth
        const newMemberEth2 = parseEther("0.2")
        await expect(newDuOutsider.setNewMemberEth(newMemberEth2)).to.be.reverted
        await expect(newDuCreator.setNewMemberEth(newMemberEth2)).to.emit(newDuCreator, "UpdateNewMemberEth")

        // 2nd added member should have been given newMemberEth
        const balanceBefore2 = await provider.getBalance(others[0].address)
        await expect(newDuAgent.addMembers(o.slice(0, 1))).to.emit(newDuAgent, "MemberJoined")
        const balanceChange2 = (await provider.getBalance(others[0].address)).sub(balanceBefore2)
        expect(balanceChange2).to.equal(newMemberEth2)
    })
})
