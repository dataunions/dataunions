import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig } from '../../src/Config'
import type { DATAv2 } from '@streamr/data-v2'
import type { DataUnion } from '../../src/DataUnion'

import { deployContracts, getWallets } from './setup'

describe('DataUnion stats getters', () => {

    let dao: Wallet
    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let removedMember: Wallet
    let outsider: Wallet
    let dataUnion: DataUnion
    let token: DATAv2
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [
            dao,
            admin,
            member,
            otherMember,
            removedMember,
            outsider,
        ] = getWallets()
        const {
            token: tokenContract,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(dao)
        token = tokenContract

        clientOptions = {
            auth: { privateKey: member.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
            },
            network: { rpcs: [{ url: ethereumUrl, timeout: 30 * 1000 }] }
        }
        const adminClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const adminDataUnion = await adminClient.deployDataUnion()
        await adminDataUnion.addMembers([member.address, otherMember.address, removedMember.address])
        await adminDataUnion.removeMembers([removedMember.address])

        const client = new DataUnionClient(clientOptions)
        dataUnion = await client.getDataUnion(adminDataUnion.getAddress())
    })

    it('DataUnion stats', async () => {
        const stats = await dataUnion.getStats()
        expect(stats.activeMemberCount.toString()).toEqual("2")
        expect(stats.inactiveMemberCount.toString()).toEqual("1")
        expect(stats.joinPartAgentCount.toString()).toEqual("2")
        expect(stats.totalEarnings.toString()).toEqual("0")
        expect(stats.totalWithdrawable.toString()).toEqual("0")
        expect(stats.lifetimeMemberEarnings.toString()).toEqual("0")
    })

    it('member stats', async () => {
        const memberStats = await dataUnion.getMemberStats(member.address)
        const memberStats2 = await dataUnion.getMemberStats(otherMember.address)
        const memberStats3 = await dataUnion.getMemberStats(removedMember.address)
        const memberStats4 = await dataUnion.getMemberStats(outsider.address)

        expect(memberStats.status).toEqual('ACTIVE')
        expect(memberStats.earningsBeforeLastJoin.toString()).toEqual("0")
        expect(memberStats.totalEarnings.toString()).toEqual("0")
        expect(memberStats.withdrawableEarnings.toString()).toEqual("0")

        expect(memberStats2.status).toEqual('ACTIVE')
        expect(memberStats2.earningsBeforeLastJoin.toString()).toEqual("0")
        expect(memberStats2.totalEarnings.toString()).toEqual("0")
        expect(memberStats2.withdrawableEarnings.toString()).toEqual("0")

        expect(memberStats3.status).toEqual('INACTIVE')
        expect(memberStats3.earningsBeforeLastJoin.toString()).toEqual("0")
        expect(memberStats3.totalEarnings.toString()).toEqual("0")
        expect(memberStats3.withdrawableEarnings.toString()).toEqual("0")

        expect(memberStats4.status).toEqual('NONE')
        expect(memberStats4.earningsBeforeLastJoin.toString()).toEqual("0")
        expect(memberStats4.totalEarnings.toString()).toEqual("0")
        expect(memberStats4.withdrawableEarnings.toString()).toEqual("0")
    })

    it('member stats: invalid address', async () => {
        expect(dataUnion.getMemberStats('invalid-address')).rejects.toThrow(/invalid address/)
    })

    it('gives DU owner correctly', async () => {
        const owner = await dataUnion.getOwner()
        expect(owner).toEqual(admin.address)
    })
})
