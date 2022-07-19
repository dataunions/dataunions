import type { Wallet } from '@ethersproject/wallet'

import type { DATAv2 } from '@streamr/data-v2'
import type { DataUnionFactory, DataUnionTemplate } from '@dataunions/contracts/typechain'

import { DataUnionClient } from '../../src/DataUnionClient'
import { deployContracts, getWallets } from './setup'

describe('DataUnion deploy', () => {

    let token: DATAv2
    let dataUnionFactory: DataUnionFactory
    let dataUnionTemplate: DataUnionTemplate
    let ethereumUrl: string
    let admin: Wallet
    let user: Wallet
    beforeAll(async () => {
        [ admin, user ] = getWallets()
        ;({
            token,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(admin))
    })

    async function getClientFor(wallet: Wallet) {
        return new DataUnionClient({
            auth: { privateKey: wallet.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
                joinPartAgentAddress: admin.address,
            },
            network: {
                name: 'dev1',
                chainId: 8996,
                rpcs: [{
                    url: ethereumUrl,
                    timeout: 30 * 1000
                }]
            },
        })
    }

    describe('owner', () => {
        it('not specified: defaults to deployer', async () => {
            const client = await getClientFor(user)
            const dataUnion = await client.deployDataUnion()
            expect(await dataUnion.getAdminAddress()).toBe(await client.getAddress())
        }, 30000)

        it('specified', async () => {
            const owner = "0x0000000000000000000000000000000000000123"
            const client = await getClientFor(user)
            const dataUnion = await client.deployDataUnion({ owner })
            expect(await dataUnion.getAdminAddress()).toBe(owner)
        }, 30000)

        it('invalid', async () => {
            const client = await getClientFor(user)
            await expect(client.deployDataUnion({ owner: 'foobar' })).rejects.toThrow(/invalid address/)
        })
    })
})
