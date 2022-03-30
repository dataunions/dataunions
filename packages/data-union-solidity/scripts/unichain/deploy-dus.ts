import hhat from "hardhat"
import { Chains } from "@streamr/config"

const { ethers } = hhat

async function main() {
    const factorytemplate = await ethers.getContractFactory("DataUnionTemplate")
    const contracttemplate = await factorytemplate.deploy()
    await contracttemplate.deployed()
    console.log(contracttemplate.address)

    const tokenAddress = Chains.load("development").streamr.contracts.Token
    const factory = await ethers.getContractFactory("DataUnionFactory")
    const contract = await factory.deploy(tokenAddress, contracttemplate.address)
    await contract.deployed()
    console.log(contract.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
