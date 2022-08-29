import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig } from '../../src/Config'

import { deployContracts, getWallets } from './setup'

describe('DataUnion metadata', () => {

    let dao: Wallet
    let admin: Wallet
    let member: Wallet
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [
            dao,
            admin,
            member,
        ] = getWallets()
        const {
            token,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(dao)

        clientOptions = {
            auth: { privateKey: member.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
            },
            network: { rpcs: [{ url: ethereumUrl, timeout: 30 * 1000 }] }
        }
    })

    async function deployDataUnion() {
        const adminClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const adminDataUnion = await adminClient.deployDataUnion()
        await adminDataUnion.addMembers([member.address])
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(adminDataUnion.getAddress())
        return { adminDataUnion, dataUnion }
    }

    it('can be set by admin only', async () => {
        const { adminDataUnion, dataUnion } = await deployDataUnion()
        const metadataBefore = await dataUnion.getMetadata()
        await expect(dataUnion.setMetadata({ testing: 123 })).rejects.toThrow(/not the DataUnion admin/)
        const metadataBefore2 = await dataUnion.getMetadata()
        await adminDataUnion.setMetadata({ testing: 123 })
        const metadataAfter = await dataUnion.getMetadata()
        expect(metadataBefore).toEqual({})
        expect(metadataBefore2).toEqual({})
        expect(metadataAfter).toEqual({ testing: 123 })
    })

    it('can be set as raw string by admin only', async () => {
        const { adminDataUnion, dataUnion } = await deployDataUnion()
        const metadataBefore = await dataUnion.getMetadataString()
        await expect(dataUnion.setMetadataString("http://test.com")).rejects.toThrow(/not the DataUnion admin/)
        const metadataBefore2 = await dataUnion.getMetadataString()
        await adminDataUnion.setMetadataString("http://test.com")
        const metadataAfter = await dataUnion.getMetadataString()
        expect(metadataBefore).toEqual("{}")
        expect(metadataBefore2).toEqual("{}")
        expect(metadataAfter).toEqual("http://test.com")
        expect(dataUnion.getMetadata()).rejects.toThrow(/not valid JSON/)
    })
})
