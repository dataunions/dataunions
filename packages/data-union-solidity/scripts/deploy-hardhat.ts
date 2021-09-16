import hardhat from "hardhat"
import type { Overrides } from "ethers"
import { parseUnits } from "@ethersproject/units"

import Debug from "debug"
const log = Debug("Streamr:du:script:deploy")

const {
    ENV,
    GASPRICE_GWEI,
} = process.env

const ethersOptions: Overrides = {
//    gasLimit: 3000000
}
if (GASPRICE_GWEI) { ethersOptions.gasPrice = parseUnits(GASPRICE_GWEI, "gwei") }

import config from "data-union-config"
const { mainnet, xdai } = (ENV === "production" ? config.production : config.dev)

async function main() {
    const DataUnionSidechain = await hardhat.ethers.getContractFactory("DataUnionSidechain")
    log("Deploying duTemplateSidechain...")
    const duTemplateSidechain = await DataUnionSidechain.deploy()
    console.log("duTemplateSidechain deployed to:", duTemplateSidechain.address)

    const DataUnionMainnet = await hardhat.ethers.getContractFactory("DataUnionMainnet")
    log("Deploying duTemplateMainnet...")
    const duTemplateMainnet = await DataUnionMainnet.deploy()
    console.log("duTemplateMainnet deployed to:", duTemplateMainnet.address)

    const DataUnionFactorySidechain = await hardhat.ethers.getContractFactory("DataUnionFactorySidechain")
    log("Deploying duFactorySidechain...")
    const duFactorySidechain = await DataUnionFactorySidechain.deploy(duTemplateSidechain.address)
    console.log("duFactorySidechain deployed to:", duFactorySidechain.address)

    const DataUnionFactoryMainnet = await hardhat.ethers.getContractFactory("DataUnionFactoryMainnet")
    log("Deploying duFactoryMainnet...")
    const duFactoryMainnet = await DataUnionFactoryMainnet.deploy(
        duTemplateMainnet.address,
        duTemplateSidechain.address,
        duFactorySidechain.address,
        mainnet.token,
        mainnet.tokenMediator,
        xdai.token,
        xdai.tokenMediator,
        2000000,
    )
    console.log("duFactoryMainnet deployed to:", duFactoryMainnet.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
