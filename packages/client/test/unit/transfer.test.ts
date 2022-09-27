import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, getWallets } from './setup'

import type { DATAv2 } from '@streamr/data-v2'
import type { BigNumberish } from '@ethersproject/bignumber'
import type { DataUnion } from '../../src/DataUnion'

// const { log } = console
const log = (..._: unknown[]) => {}

describe('DataUnion earnings transfer methods', () => {

    let dao: Wallet
    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let outsider: Wallet
    let token: DATAv2
    let dataUnion: DataUnion
    let outsiderDataUnion: DataUnion
    beforeAll(async () => {
        [
            dao,
            admin,
            member,
            otherMember,
            outsider,
        ] = getWallets()
        const {
            token: tokenContract,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(dao)
        token = tokenContract

        const clientOptions = {
            auth: { privateKey: member.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
            },
            network: { rpcs: [{ url: ethereumUrl, timeout: 30 * 1000 }] }
        }

        // deploy a DU with admin fee 9% + DU fee 1% = total 10% fees
        const adminClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const adminDataUnion = await adminClient.deployDataUnion({ adminFee: 0.09 })
        await adminDataUnion.addMembers([member.address, otherMember.address])

        const client = new DataUnionClient(clientOptions)
        dataUnion = await client.getDataUnion(adminDataUnion.getAddress())

        const outsiderClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: outsider.privateKey } })
        outsiderDataUnion = await outsiderClient.getDataUnion(dataUnion.getAddress())
    })

    async function fundDataUnion(dataUnionAddress: string, amountWei: BigNumberish) {
        await (await token.mint(await token.signer.getAddress(), amountWei)).wait()
        await (await token.transferAndCall(dataUnionAddress, amountWei, '0x')).wait()
        // log("DU stats: %o", await dataUnion.getStats())
    }

    it('can refresh DataUnion earnings after ERC20 token transfer', async () => {
        const balanceBefore = await token.balanceOf(dataUnion.getAddress())
        const statsBefore = await dataUnion.getMemberStats(member.address)
        await (await token.mint(dataUnion.getAddress(), parseEther('1'))).wait()
        const balanceAfterMint = await token.balanceOf(dataUnion.getAddress())
        const statsAfterMint = await dataUnion.getMemberStats(member.address)
        await dataUnion.refreshRevenue()
        const balanceAfter = await token.balanceOf(dataUnion.getAddress())
        const statsAfter = await dataUnion.getMemberStats(member.address)
        expect(formatEther(statsAfterMint.withdrawableEarnings.sub(statsBefore.withdrawableEarnings))).toEqual('0.0')
        expect(formatEther(statsAfter.withdrawableEarnings.sub(statsBefore.withdrawableEarnings))).toEqual('0.45')
        expect(formatEther(balanceAfterMint.sub(balanceBefore))).toEqual('1.0')
        expect(formatEther(balanceAfter.sub(balanceBefore))).toEqual('1.0')
    })

    it('transfer earnings to another member within data union', async () => {
        await fundDataUnion(dataUnion.getAddress(), parseEther('2'))

        const statsBefore = await dataUnion.getMemberStats(member.address)
        const stats2Before = await dataUnion.getMemberStats(otherMember.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        log('Transfer 1 token worth of earnings with transferWithinContract: %s -> %s', member.address, otherMember.address)
        await dataUnion.transferWithinContract(otherMember.address, parseEther('0.9')) // 1 - 10% fees

        const statsAfter = await dataUnion.getMemberStats(member.address)
        const stats2After = await dataUnion.getMemberStats(otherMember.address)
        log('Stats after: %O, %O', statsAfter, stats2After)

        const earningsChange = statsAfter.totalEarnings.sub(statsBefore.totalEarnings)
        const earnings2Change = stats2After.totalEarnings.sub(stats2Before.totalEarnings)
        const withdrawableChange = statsAfter.withdrawableEarnings.sub(statsBefore.withdrawableEarnings)
        const withdrawable2Change = stats2After.withdrawableEarnings.sub(stats2Before.withdrawableEarnings)

        // 1 token is withdrawn from sender's earnings, and added to recipient's earnings as "special income" (mixed with "withdrawable before join")
        expect(formatEther(earningsChange)).toEqual('0.0')
        expect(formatEther(withdrawableChange)).toEqual('-0.9')
        expect(formatEther(earnings2Change)).toEqual('0.9')
        expect(formatEther(withdrawable2Change)).toEqual('0.9')
    })

    // TODO: add test for error_insufficientBalance (remove fundDataUnion, basically)

    it.each([true, false])('transfer token from outside to member earnings, approveFirst=%p', async (approveFirst: boolean) => {
        // TODO: use outsider once it works, see ETH-321; remove these 2 lines and use the commented-out below
        // await (await token.mint(member.address, parseEther('1'))).wait()

        await (await token.mint(outsider.address, parseEther('1'))).wait()
        const statsBefore = await dataUnion.getMemberStats(member.address)
        const stats2Before = await dataUnion.getMemberStats(otherMember.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        // if approval hasn't been done, transferToMemberInContract should do it; test both with and without
        // TODO: this can be removed as soon as ERC677 feature is deployed; see DataUnion.ts:transferToMemberInContract
        if (approveFirst) {
            await (await token.connect(outsider).approve(dataUnion.getAddress(), parseEther('1'))).wait()
            // await (await token.connect(member).approve(dataUnion.getAddress(), parseEther('1'))).wait()
            // log(`Approved DU ${dataUnion.getAddress()} to spend 1 token from ${outsider.address}`)
        }

        log(`Transfer 1 token with transferToMemberInContract to ${member.address}`)
        await outsiderDataUnion.transferToMemberInContract(member.address, parseEther('1'))

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
