import { ethers, upgrades } from "hardhat"

import { getAddress } from "@ethersproject/address"

import { config } from "@streamr/config"

import { DataUnionFactory, DefaultFeeOracle } from "../../typechain"
import { parseEther } from "@ethersproject/units"

const {
    PROTOCOL_BENEFICIARY_ADDRESS,
    CHAIN = "dev2"
} = process.env

const {
    contracts: {
        DATA: tokenAddress
    }
} = (config as any)[CHAIN]

if (!PROTOCOL_BENEFICIARY_ADDRESS) { throw new Error("Environment variable PROTOCOL_BENEFICIARY_ADDRESS not set") }
const protocolBeneficiaryAddress = getAddress(PROTOCOL_BENEFICIARY_ADDRESS)

async function main() {
    const signer = (await ethers.getSigners())[0]
    console.log("Deploying DU contracts from %s", await signer.getAddress())
    console.log("Native token balance: %s", ethers.utils.formatEther(await signer.getBalance()))

    const dataUnionTemplateFactory = await ethers.getContractFactory("DataUnionTemplate", { signer })
    const dataUnionTemplate = await dataUnionTemplateFactory.deploy()
    await dataUnionTemplate.deployed()
    console.log("DU template deployed at %s", dataUnionTemplate.address)

    const feeOracleFactory = await ethers.getContractFactory("DefaultFeeOracle", { signer })
    const feeOracle = await upgrades.deployProxy(feeOracleFactory, [
        parseEther("0.01"),
        protocolBeneficiaryAddress
    ], { kind: "uups" }) as DefaultFeeOracle
    await feeOracle.deployed()
    console.log("Fee oracle deployed at %s", feeOracle.address)

    const factoryFactory = await ethers.getContractFactory("DataUnionFactory", { signer })
    const factory = await upgrades.deployProxy(factoryFactory, [
        dataUnionTemplate.address,
        tokenAddress,
        feeOracle.address,
    ], { kind: "uups" }) as DataUnionFactory
    console.log("DU factory deployed at %s", factory.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
