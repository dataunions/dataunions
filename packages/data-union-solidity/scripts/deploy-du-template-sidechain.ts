import hhat from "hardhat"

const { ethers } = hhat

async function main() {
    const contractName = "DataUnionSidechain"
    const factory = await ethers.getContractFactory(contractName)
    const contract = await factory.deploy()
    console.log(contract.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
