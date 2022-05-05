function toNumber(value: any): number | undefined {
    return (value !== undefined) ? Number(value) : undefined
}

/**
 * Streamr client constructor options that work in the test environment
 */
export const ConfigTest = {
    theGraphUrl: `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8000/subgraphs/name/streamr-dev/network-contracts`,
    restUrl: process.env.REST_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || 'localhost'}/api/v2`,
    tokenAddress: process.env.TOKEN_ADDRESS || '0xbAA81A0179015bE47Ad439566374F2Bae098686F',
    dataUnion: {
        factoryAddress: process.env.DU_FACTORY || '0x4bbcBeFBEC587f6C4AF9AF9B48847caEa1Fe81dA',
        templateAddress: process.env.DU_TEMPLATE || '0x7bFBAe10AE5b5eF45e2aC396E0E605F6658eF3Bc',
        joinPartAgentAddress: '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c',
    },
    network: {
        name: 'dev_1',
        chainId: 8995,
        rpcs: [{
            url: process.env.ETHEREUM_SERVER_URL || `http://${process.env.STREAMR_DOCKER_DEV_HOST || '10.200.10.1'}:8545`,
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
