import { defaultPath } from "@ethersproject/hdnode"

import { HardhatUserConfig } from "hardhat/types"
import "@nomiclabs/hardhat-waffle"

import "hardhat-typechain"
import "solidity-coverage"
import "hardhat-deploy"

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: "berlin",
        }
    },
    paths: {
        deploy: "scripts/hardhat-deploy",
        deployments: "build/deployments",
        artifacts: "build/hardhat-artifacts",
        cache: "build/cache",
    },
    networks: {
        hardhat: {},
        mock_mainnet: {
            chainId: 8995,
            url: "http://localhost:8545",
            accounts: {
                mnemonic: "testrpc",    // TODO: double check in smart-contracts-init repo
                path: defaultPath,
                count: 8,
            },
        },
        mock_xdai: {
            chainId: 8997,
            url: "http://localhost:8546",
            companionNetworks: {
                l1: "mock_mainnet",
            }
        }
    },
    namedAccounts: {
        deployer: {
            default: 0,
            mock_mainnet: "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0",
            mock_xdai: "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0",
        }
    },
    typechain: {
        outDir: "./typechain",
        target: "ethers-v5",
    }
}
export default config