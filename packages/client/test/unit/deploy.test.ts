import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig } from '../../src/Config'

import { deployContracts, getWallets } from './setup'

describe('DataUnion deploy', () => {

    let admin: Wallet
    let user: Wallet
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [ admin, user ] = getWallets()
        const {
            token,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(admin)
        clientOptions = {
            auth: { privateKey: user.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
                duBeneficiaryAddress: admin.address,
                joinPartAgentAddress: "0x0000000000000000000000000000000000000000",
            },
            network: {
                rpcs: [{
                    url: ethereumUrl,
                    timeout: 30 * 1000
                }]
            },
        }
    }, 30000)

    describe('owner', () => {
        it('not specified: defaults to deployer', async () => {
            const client = new DataUnionClient(clientOptions)
            const dataUnion = await client.deployDataUnion()
            expect(await dataUnion.getAdminAddress()).toBe(await client.getAddress())
        }, 30000)

        it('specified', async () => {
            const owner = "0x0000000000000000000000000000000000000123"
            const client = new DataUnionClient(clientOptions)
            const dataUnion = await client.deployDataUnion({ owner })
            expect(await dataUnion.getAdminAddress()).toBe(owner)
        }, 30000)

        it('invalid', async () => {
            const client = new DataUnionClient(clientOptions)
            await expect(client.deployDataUnion({ owner: 'foobar' })).rejects.toThrow(/invalid address/)
        })
    })

    // TODO: tests for calculateAddress
})
