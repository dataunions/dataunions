import { config } from "@streamr/config"

const {
    dev2: {
        contracts: {
            DATA: tokenAddress,
            DataUnionFactory: factoryAddress,
            DataUnionTemplate: templateAddress,
        }
    },
    dev0: {
        contracts: {
            "core-api": joinPartAgentAddress
        }
    }
} = config

function toNumber(value: any): number | undefined {
    return (value !== undefined) ? Number(value) : undefined
}

/**
 * Streamr client constructor options that work in the test environment
 */
export const ConfigTest = {
    // theGraphUrl: `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8000/subgraphs/name/streamr-dev/network-contracts`,
    restUrl: process.env.REST_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || 'localhost'}/api/v2`,
    tokenAddress: process.env.TOKEN_ADDRESS || tokenAddress,
    dataUnion: {
        factoryAddress: process.env.DU_FACTORY || factoryAddress,
        templateAddress: process.env.DU_TEMPLATE || templateAddress,
        joinPartAgentAddress, // TODO: this should be the join server
    },
    network: {
        name: 'dev2',
        chainId: 31337,
        rpcs: [{
            url: process.env.ETHEREUM_SERVER_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8547`,
            timeout: toNumber(process.env.TEST_TIMEOUT) ?? 30 * 1000
        }]
    },
    _timeouts: {
        theGraph: {
            timeout: 10 * 1000,
            retryInterval: 500
        },
        jsonRpc: {
            timeout: 20 * 1000,
            retryInterval: 500
        },
        httpFetch: {
            timeout: 30 * 1000,
            retryInterval: -1
        }
    }
}
