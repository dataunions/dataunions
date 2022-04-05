import hhat from "hardhat"
import { Chains } from "@streamr/config"

const { ethers } = hhat

async function main() {
    const factoryTemplate = await ethers.getContractFactory("DataUnionTemplate")
    const contractTemplate = await factoryTemplate.deploy()
    await contractTemplate.deployed()
    console.log(contractTemplate.address)

    const tokenAddress = Chains.load("development").streamr.contracts.Token
    const factory = await ethers.getContractFactory("DataUnionFactory")
    const contract = await factory.deploy(contractTemplate.address, tokenAddress)
    await contract.deployed()
    console.log(contract.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
