import { HardhatUserConfig } from "hardhat/types"
import "@nomiclabs/hardhat-waffle"

import "hardhat-typechain"
import "solidity-coverage"

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            evmVersion: "istanbul",
        }
    },
    networks: {
        hardhat: {},
        dev_xdai: {
            chainId: 8997,
            url: "http://localhost:8546",
            accounts: ["0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"]
        },
        dev: {
            chainId: 8995,
            url: "http://localhost:8545",
            accounts: ["0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"]
        },
        xdai: {
            chainId: 100,
            url: "https://rpc.xdaichain.com/",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        },
        mainnet: {
            chainId: 1,
            url: "https://mainnet.infura.io/v3/" + process.env.INFURA_KEY || "",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        }
    },
    typechain: {
        outDir: "./typechain",
        target: "ethers-v5",
    }
}
export default config