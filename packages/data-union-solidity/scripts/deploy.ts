// scripts/deploy.js
import hhat from "hardhat"
import { DataUnionSidechain } from "../typechain/DataUnionSidechain"

const { ethers } = hhat

async function main() {

    const DataUnionSidechaina = await ethers.getContractFactory("DataUnionSidechain")
    console.log("Deploying DataUnionSidechain...")
    const aataUnionSidechain = await DataUnionSidechaina.deploy()  as DataUnionSidechain
    console.log("DataUnionSidechain deployed to:", aataUnionSidechain.address)
    console.log(await aataUnionSidechain.isInitialized())
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
