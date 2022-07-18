import { networks } from "@streamr/config"

function toNumber(value: any): number | undefined {
    return (value !== undefined) ? Number(value) : undefined
}

/**
 * Streamr client constructor options that work in the test environment
 */
export const ConfigTest = {
    theGraphUrl: `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8000/subgraphs/name/streamr-dev/network-contracts`,
    restUrl: process.env.REST_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || 'localhost'}/api/v2`,
    tokenAddress: process.env.TOKEN_ADDRESS || networks.dev1.contracts.DATA,
    dataUnion: {
        factoryAddress: process.env.DU_FACTORY || networks.dev1.contracts.DataUnionFactory,
        templateAddress: process.env.DU_TEMPLATE || networks.dev1.contracts.DataUnionTemplate,
        joinPartAgentAddress: networks.dev0.contracts["core-api"], // TODO: this should be the join server
    },
    network: {
        name: 'dev1',
        chainId: 8996,
        rpcs: [{
            url: process.env.ETHEREUM_SERVER_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8546`,
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
