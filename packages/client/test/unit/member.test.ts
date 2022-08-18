import { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, deployDataUnion, getWallets } from './setup'

import type { DataUnionClientConfig } from '../../src/Config'
import type { DATAv2 } from '@streamr/data-v2'

describe('DataUnion member', () => {

    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let duAddress: string
    let token: DATAv2
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [
            admin,
            member,
            otherMember,
        ] = getWallets()
        const {
            token: tokenContract,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(admin)
        token = tokenContract
        const duContract = await deployDataUnion(dataUnionFactory, token)
        duAddress = duContract.address
        await (await duContract.addMembers([member.address, otherMember.address])).wait()

        clientOptions = {
            auth: {
                privateKey: member.privateKey
            },
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
            }
        }
    })

    it('cannot be just any random address', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(duAddress)
        expect(await dataUnion.isMember(Wallet.createRandom().address)).toBe(false)
        expect(await dataUnion.isMember("0x0000000000000000000000000000000000000000")).toBe(false)
    })

    it('can part from the data union', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(duAddress)

        const isMemberBefore = await dataUnion.isMember()
        await dataUnion.part()
        const isMemberAfter = await dataUnion.isMember()

        expect(isMemberBefore).toBe(true)
        expect(isMemberAfter).toBe(false)
    })

    it('can be added by admin', async () => {
        const userAddress = Wallet.createRandom().address

        const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const dataUnion = await client.getDataUnion(duAddress)
        await dataUnion.addMembers([userAddress])
        const isMember = await dataUnion.isMember(userAddress)
        expect(isMember).toBe(true)
    })

    it('can be removed by admin', async () => {
        const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const dataUnion = await client.getDataUnion(duAddress)
        await dataUnion.removeMembers([otherMember.address])
        const isMember = await dataUnion.isMember(otherMember.address)
        expect(isMember).toBe(false)
    })

    it('functions fail for invalid address', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(duAddress)
        return Promise.all([
            expect(() => dataUnion.addMembers(['invalid-address'])).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.removeMembers(['invalid-address'])).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.isMember('invalid-address')).rejects.toThrow(/invalid address/),
        ])
    })
})
