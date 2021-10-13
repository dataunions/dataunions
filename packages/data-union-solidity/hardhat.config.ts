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
            evmVersion: "berlin",
        }
    },
    networks: {
        hardhat: {},
        localsidechain: {
            chainId: 8997,
            url: 'http://localhost:8546',
            accounts: ['0x0000000000000000000000000000000000000000000000000000000000000008']
        }
    },
    typechain: {
        outDir: "./typechain",
        target: "ethers-v5",
    }
}
export default config