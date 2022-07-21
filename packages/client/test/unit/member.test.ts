import { parseEther, formatEther } from '@ethersproject/units'
import { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, deployDataUnion, getWallets } from './setup'

import type { DataUnionClientConfig } from '../../src/Config'
import type { DATAv2 } from '@streamr/data-v2'

describe('DataUnion member', () => {

    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let outsider: Wallet
    let clientOptions: DataUnionClientConfig
    let duAddress: string
    let token: DATAv2
    beforeAll(async () => {
        [
            admin,
            member,
            otherMember,
            outsider
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
                name: 'dev1',
                chainId: 8996,
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

    // TODO: after join server is implemented
    // it('join with valid secret', async () => {
    // })
    // it('cannot join with invalid secret', async () => {
    // })
    // it('can leave a join request without secret', async () => {
    // })

    it('can part from the data union', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(duAddress)

        const isMemberBefore = await dataUnion.isMember()
        await dataUnion.part()
        const isMemberAfter = await dataUnion.isMember()

        expect(isMemberBefore).toBe(true)
        expect(isMemberAfter).toBe(false)
    })

    // re-enable after ETH-321 is done
    it.skip('can be added by admin', async () => {
        const userAddress = Wallet.createRandom().address

        const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const dataUnion = await client.getDataUnion(duAddress)
        await dataUnion.addMembers([userAddress])
        const isMember = await dataUnion.isMember(userAddress)
        expect(isMember).toBe(true)
    })

    // re-enable after ETH-321 is done
    it.skip('can be removed by admin', async () => {
        const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const dataUnion = await client.getDataUnion(duAddress)
        await dataUnion.removeMembers([otherMember.address])
        const isMember = await dataUnion.isMember(otherMember.address)
        expect(isMember).toBe(true)
    }, 60000)

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
