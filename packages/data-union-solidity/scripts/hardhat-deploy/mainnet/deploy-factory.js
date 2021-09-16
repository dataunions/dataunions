import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/dist/types"

const from = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
// const gasLimit = 2000000

async function deployFunction({ deployments, getNamedAccounts }: HardhatRuntimeEnvironment): DeployFunction {
    const { deploy } = deployments
    const { deployer } = getNamedAccounts()

    const duTemplateMainnet = deployments.get("DataUnionMainnet")

    // TODO: get duTemplateSidechain, duFactorySidechain from https://hardhat.org/plugins/hardhat-deploy.html#companionnetworks
    // TODO: figure out the "hardhat way" of doing token/-mediator configs/deployments

    await deploy("DataUnionFactoryMainnet", {
        from: deployer,
        // gasLimit,
        args: [
            duTemplateMainnet.address,
            duTemplateSidechain.address,
            duFactorySidechain.address,
            mainnet.token,
            mainnet.tokenMediator,
            xdai.token,
            xdai.tokenMediator,
            2000000,
        ]
    })
    return true // don't execute twice
}

deployFunction.tags = ["DataUnionFactoryMainnet"]
deployFunction.id = "DataUnionFactoryMainnet"
deployFunction.dependencies = ["DataUnionTemplateMainnet", "DataUnionTemplateSidechain", "DataUnionFactorySidechain"]

export default deployFunction
