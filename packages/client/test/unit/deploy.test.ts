import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig } from '../../src/Config'

import { deployContracts, getWallets } from './setup'

describe('DataUnion deploy', () => {

    let dao: Wallet
    let user: Wallet
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [ dao, user ] = getWallets()
        const {
            token,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(dao)
        clientOptions = {
            auth: { privateKey: user.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
            },
            network: { rpcs: [{ url: ethereumUrl, timeout: 30 * 1000 }] }
        }
    })

    describe('owner', () => {
        it('not specified: defaults to deployer', async () => {
            const client = new DataUnionClient(clientOptions)
            const dataUnion = await client.deployDataUnion()
            expect(await dataUnion.getAdminAddress()).toBe(await client.getAddress())
        })

        it('specified', async () => {
            const adminAddress = "0x0000000000000000000000000000000000000123"
            const client = new DataUnionClient(clientOptions)
            const dataUnion = await client.deployDataUnion({ adminAddress })
            expect(await dataUnion.getAdminAddress()).toBe(adminAddress)
        })

        it('invalid', async () => {
            const client = new DataUnionClient(clientOptions)
            await expect(client.deployDataUnion({ adminAddress: 'foobar' })).rejects.toThrow(/invalid address/)
        })
    })

    // TODO: tests for calculateAddress
})
