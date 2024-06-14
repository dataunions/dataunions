import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@openzeppelin/hardhat-upgrades"
import "hardhat-typechain"
import "solidity-coverage"
import type { HardhatUserConfig } from "hardhat/types"

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
    // for network names, see https://github.com/streamr-dev/network-contracts/blob/master/packages/config/src/networks.json
    networks: {
        dev2: {
            chainId: 31337,
            url: "http://localhost:8547",
            accounts: ["0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"]
        },
        dev1: {
            chainId: 8997,
            url: "http://localhost:8546",
            accounts: ["0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"]
        },
        dev0: {
            chainId: 8995,
            url: "http://localhost:8545",
            accounts: ["0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"]
        },
        gnosis: {
            chainId: 100,
            url: "https://rpc.gnosischain.com",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        },
        polygon: {
            chainId: 137,
            url: "https://polygon-rpc.com",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        },
        polygonAmoy: {
            chainId: 80002,
            url: process.env.ETHEREUM_RPC || "https://rpc-amoy.polygon.technology",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        },
        ethereum: {
            chainId: 1,
            url: "https://mainnet.infura.io/v3/" + process.env.INFURA_KEY || "",
            accounts: [process.env.KEY || "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"] // dummy key
        }
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5"
    },
    etherscan: {
        apiKey: {
            polygon: process.env.ETHERSCAN_KEY || "",
            polygonMumbai: process.env.ETHERSCAN_KEY || "",
            polygonAmoy: process.env.ETHERSCAN_KEY || "",
            peaq: process.env.ETHERSCAN_KEY || "",
        },
        customChains: [{
            network: "polygonAmoy",
            chainId: 80002,
            urls: {
                apiURL: "https://api-amoy.polygonscan.com/api",
                browserURL: "https://amoy.polygonscan.com"
            },
        }]
    },
}
export default config
