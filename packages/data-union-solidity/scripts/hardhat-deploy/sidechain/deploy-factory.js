import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/dist/types"

const from = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
// const gasLimit = 2000000

async function deployFunction({ deployments: { deploy } }: HardhatRuntimeEnvironment): DeployFunction {
    await deploy("DataUnionFactorySidechain", {
        from,
        // gasLimit,
        args: [ duTemplateSidechain.address ],
    })
    return true // don't execute twice
}

deployFunction.tags = ["DataUnionFactorySidechain"]
deployFunction.id = "DataUnionFactorySidechain"
deployFunction.dependencies = ["DataUnionTemplateSidechain"]

export default deployFunction
