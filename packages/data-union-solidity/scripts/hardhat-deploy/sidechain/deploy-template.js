import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/dist/types"

const from = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
// const gasLimit = 2000000

async function deployFunction({ deployments: { deploy } }: HardhatRuntimeEnvironment): DeployFunction {
    await deploy("DataUnionSidechain", {
        from,
        // gasLimit,
        args: []
    })
    return true // don't execute twice
}

deployFunction.tags = ["DataUnionTemplateSidechain"]
deployFunction.id = "DataUnionTemplateSidechain"
deployFunction.dependencies = []

export default deployFunction
