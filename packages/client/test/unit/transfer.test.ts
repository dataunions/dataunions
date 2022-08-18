import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, getWallets } from './setup'

import type { DATAv2 } from '@streamr/data-v2'
import type { BigNumberish } from '@ethersproject/bignumber'
import type { DataUnion } from '../../src/DataUnion'

const { log } = console

describe('DataUnion earnings transfer methods', () => {

    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let token: DATAv2
    let dataUnion: DataUnion
    beforeAll(async () => {
        [
            admin,
            member,
            otherMember,
            // outsider,
        ] = getWallets()
        const {
            token: tokenContract,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(admin)
        token = tokenContract

        const clientOptions = {
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

        const adminClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const adminDataUnion = await adminClient.deployDataUnion()
        await adminDataUnion.addMembers([member.address, otherMember.address])

        const client = new DataUnionClient(clientOptions)
        dataUnion = await client.getDataUnion(adminDataUnion.getAddress())
    })

    async function fundDataUnion(dataUnionAddress: string, amountWei: BigNumberish) {
        await (await token.mint(await token.signer.getAddress(), amountWei)).wait()
        await (await token.transferAndCall(dataUnionAddress, amountWei, '0x')).wait()
        // log("DU stats: %o", await dataUnion.getStats())
    }

    it('transfer earnings to another member within data union', async () => {
        await fundDataUnion(dataUnion.getAddress(), parseEther('2'))

        const statsBefore = await dataUnion.getMemberStats(member.address)
        const stats2Before = await dataUnion.getMemberStats(otherMember.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        log('Transfer 1 token worth of earnings with transferWithinContract: %s -> %s', member.address, otherMember.address)
        await dataUnion.transferWithinContract(otherMember.address, parseEther('1'))

        const statsAfter = await dataUnion.getMemberStats(member.address)
        const stats2After = await dataUnion.getMemberStats(otherMember.address)
        log('Stats after: %O, %O', statsAfter, stats2After)

        const earningsChange = statsAfter.totalEarnings.sub(statsBefore.totalEarnings)
        const earnings2Change = stats2After.totalEarnings.sub(stats2Before.totalEarnings)
        const withdrawableChange = statsAfter.withdrawableEarnings.sub(statsBefore.withdrawableEarnings)
        const withdrawable2Change = stats2After.withdrawableEarnings.sub(stats2Before.withdrawableEarnings)

        // 1 token is withdrawn from sender's earnings, and added to recipient's earnings as "special income" (mixed with "withdrawable before join")
        expect(formatEther(earningsChange)).toEqual('0.0')
        expect(formatEther(withdrawableChange)).toEqual('-1.0')
        expect(formatEther(earnings2Change)).toEqual('1.0')
        expect(formatEther(withdrawable2Change)).toEqual('1.0')
    })

    // TODO: add test for error_insufficientBalance (remove fundDataUnion, basically)

    it.each([true, false])('transfer token from outside to member earnings, approveFirst=%p', async (approveFirst: boolean) => {
        // TODO: use outsider once it works, see ETH-321; remove these 2 lines and use the commented-out below
        await (await token.mint(member.address, parseEther('1'))).wait()

        // const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: outsider.privateKey } })
        // await (await token.mint(outsider.address, parseEther('1'))).wait()
        const statsBefore = await dataUnion.getMemberStats(member.address)
        const stats2Before = await dataUnion.getMemberStats(otherMember.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        // if approval hasn't been done, transferToMemberInContract should do it; test both with and without
        // TODO: this can be removed as soon as ERC677 feature is deployed; see DataUnion.ts:transferToMemberInContract
        if (approveFirst) {
            // await (await token.connect(outsider).approve(duAddress, parseEther('1'))).wait()
            await (await token.connect(member).approve(dataUnion.getAddress(), parseEther('1'))).wait()
            // log(`Approved DU ${dataUnion.getAddress()} to spend 1 token from ${outsider.address}`)
        }

        log(`Transfer 1 token with transferToMemberInContract to ${member.address}`)
        await dataUnion.transferToMemberInContract(member.address, parseEther('1'))

        const statsAfter = await dataUnion.getMemberStats(member.address)
        const stats2After = await dataUnion.getMemberStats(otherMember.address)
        log('Stats after: %O, %O', statsAfter, stats2After)

        const earningsChange = statsAfter.totalEarnings.sub(statsBefore.totalEarnings)
        const earnings2Change = stats2After.totalEarnings.sub(stats2Before.totalEarnings)
        const withdrawableChange = statsAfter.withdrawableEarnings.sub(statsBefore.withdrawableEarnings)
        const withdrawable2Change = stats2After.withdrawableEarnings.sub(stats2Before.withdrawableEarnings)

        // 1 token is added to recipient's earnings, other members remain unaffected
        expect(formatEther(earningsChange)).toEqual('1.0')
        expect(formatEther(withdrawableChange)).toEqual('1.0')
        expect(formatEther(earnings2Change)).toEqual('0.0')
        expect(formatEther(withdrawable2Change)).toEqual('0.0')
    })
})
