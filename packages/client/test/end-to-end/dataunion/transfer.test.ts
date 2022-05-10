/* eslint-disable no-await-in-loop */
import debug from 'debug'
import { Wallet } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { authFetch } from '../../../src/authFetch'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import type { EthereumAddress } from '../../../src/types'
import { getEndpointUrl } from '../../../src/utils'
import {
    getTestWallet, provider, tokenAdminPrivateKey
} from '../devEnvironment'

const log = debug('DataUnionClient::DataUnion::integration-test-transfer')

const tokenAdminWallet = new Wallet(tokenAdminPrivateKey, provider)
const tokenAdminClient = new DataUnionClient({
    ...ConfigTest,
    auth: {
        privateKey: tokenAdminPrivateKey
    }
})
const token = tokenAdminClient.getToken()

async function addMember(dataUnionAddress: EthereumAddress, secret: string) {
    const privateKey = `0x100000000000000000000000000000000000000012300000001${Date.now()}`
    log('Joining a new member with privatekey %s', privateKey)
    const memberClient = new DataUnionClient({
        ...ConfigTest,
        auth: {
            privateKey
        }
    } as any)
    const memberDataUnion = await memberClient.getDataUnion(dataUnionAddress)
    const res = await memberDataUnion.join(secret)
    log('Member joined data union: %O', res)

    const memberWallet = new Wallet(privateKey, provider)
    return memberWallet
}

describe('DataUnion earnings transfer methods', () => {
    beforeAll(async () => {
        log('Connecting to Ethereum networks, clientOptions: %O', ConfigTest)
        const network = await provider.getNetwork()
        log('Connected to network: %O', network)

        log('Distributing mainnet ETH to following addresses:')
        for (let i = 1; i <= 2; i++) {
            const testWallet = getTestWallet(i)
            log('    #%d: %s', i, testWallet.address)
            const sendTx = await tokenAdminWallet.sendTransaction({
                to: testWallet.address,
                value: parseEther('1')
            })
            await sendTx.wait()
        }

        log('Distributing sidechain ETH to following addresses:')
        for (let i = 1; i <= 2; i++) {
            const testWallet = getTestWallet(i)
            log('    #%d: %s', i, testWallet.address)
            const sendTx = await tokenAdminWallet.sendTransaction({
                to: testWallet.address,
                value: parseEther('1')
            })
            await sendTx.wait()
        }

        log('Distributing 10 sidechain DATA to following addresses:')
        for (let i = 1; i <= 2; i++) {
            const testWallet = getTestWallet(i)
            log('    #%d: %s', i, testWallet.address)
            const sendTx = await token.transfer(testWallet.address, parseEther('10'))
            await sendTx.wait()
        }
    }, 1500000)

    async function setupTest(testIndex: number) {
        const adminWallet = getTestWallet(testIndex)

        const adminClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: adminWallet.privateKey,
            },
        })

        const dataUnion = await adminClient.deployDataUnion()
        const dataUnionAddress = dataUnion.getAddress()
        const secret = await dataUnion.createSecret('test secret')

        log('DU mainnet address: %s', dataUnionAddress)
        log('DU sidechain address: %s', dataUnion.contract.address)
        log('DU owner: %s', await dataUnion.getAdminAddress())
        log('Sending tx from %s', await adminClient.getAddress())

        // product is needed for join requests to analyze the DU version
        const createProductUrl = getEndpointUrl(ConfigTest.restUrl, 'products')
        await authFetch(createProductUrl, {
            method: 'POST',
            body: JSON.stringify({
                beneficiaryAddress: dataUnion.getAddress(),
                type: 'DATAUNION',
                dataUnionVersion: 2
            }),
            // @ts-expect-error
            session: adminClient.session,
        })

        const memberWallet = await addMember(dataUnionAddress, secret)
        log(`DU member count: ${await dataUnion.contract.activeMemberCount()}`)

        const member2Wallet = await addMember(dataUnionAddress, secret)
        log(`DU member count: ${await dataUnion.contract.activeMemberCount()}`)

        log('Transfer sidechain ETH to %s for transferWithinContract tx', memberWallet.address)
        const sendTx = await adminWallet.sendTransaction({
            to: memberWallet.address,
            value: parseEther('0.1')
        })
        await sendTx.wait()

        const transferTx = await token.transfer(dataUnion.contract.address, parseEther('4'))
        await transferTx.wait()
        log('sidechain token transfer done')

        const refreshTx = await dataUnion.contract.refreshRevenue()
        await refreshTx.wait()
        log('refreshRevenue done')

        return {
            memberWallet,
            member2Wallet,
            dataUnion
        }
    }

    it('transfer earnings to another member within data union', async () => {
        const {
            memberWallet,
            member2Wallet,
            dataUnion
        } = await setupTest(1)

        const memberClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: memberWallet.privateKey,
            },
        })
        const memberDataUnion = await memberClient.getDataUnion(dataUnion.getAddress())

        const statsBefore = await dataUnion.getMemberStats(memberWallet.address)
        const stats2Before = await dataUnion.getMemberStats(member2Wallet.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        log('%s sidechain-ETH balance: %s', memberWallet.address, await provider.getBalance(memberWallet.address))
        log('%s sidechain-DATA balance: %s', memberWallet.address, await token.balanceOf(memberWallet.address))

        log('Transfer 1 token worth of earnings with transferWithinContract: %s -> %s', memberWallet.address, member2Wallet.address)
        await memberDataUnion.transferWithinContract(member2Wallet.address, parseEther('1'))

        const statsAfter = await dataUnion.getMemberStats(memberWallet.address)
        const stats2After = await dataUnion.getMemberStats(member2Wallet.address)
        log('Stats after: %O, %O', statsAfter, stats2After)

        // 1 token is withdrawn from sender's earnings
        expect(formatEther(statsBefore.totalEarnings)).toEqual('2.0')
        expect(formatEther(statsBefore.withdrawableEarnings)).toEqual('2.0')
        expect(formatEther(statsAfter.totalEarnings)).toEqual('2.0')
        expect(formatEther(statsAfter.withdrawableEarnings)).toEqual('1.0')

        // 1 token is added to recipient's earnings
        expect(formatEther(stats2Before.totalEarnings)).toEqual('2.0')
        expect(formatEther(stats2Before.withdrawableEarnings)).toEqual('2.0')
        expect(formatEther(stats2After.totalEarnings)).toEqual('3.0')
        expect(formatEther(stats2After.withdrawableEarnings)).toEqual('3.0')
    }, 1500000)

    it.each([true, false])('transfer token from outside to member earnings, approveFirst=%p', async (approveFirst: boolean) => {
        const {
            memberWallet,
            member2Wallet,
            dataUnion
        } = await setupTest(2)
        const adminWalletSidechain = getTestWallet(2)

        const statsBefore = await dataUnion.getMemberStats(memberWallet.address)
        const stats2Before = await dataUnion.getMemberStats(member2Wallet.address)
        log('Stats before: %O, %O', statsBefore, stats2Before)

        // if approval hasn't been done, transferToMemberInContract should do it
        if (approveFirst) {
            const approve = await token.approve(dataUnion.getAddress(), parseEther('1'))
            await approve.wait()
            log(`Approve DU ${dataUnion.getAddress()} to access 1 token from ${adminWalletSidechain.address}`)
        }

        log(`Transfer 1 token with transferToMemberInContract to ${memberWallet.address}`)
        await dataUnion.transferToMemberInContract(memberWallet.address, parseEther('1'))

        const statsAfter = await dataUnion.getMemberStats(memberWallet.address)
        const stats2After = await dataUnion.getMemberStats(member2Wallet.address)
        log('Stats after: %O, %O', statsAfter, stats2After)

        // 1 token is added to recipient's earnings
        expect(formatEther(statsBefore.totalEarnings)).toEqual('2.0')
        expect(formatEther(statsBefore.withdrawableEarnings)).toEqual('2.0')
        expect(formatEther(statsAfter.totalEarnings)).toEqual('3.0')
        expect(formatEther(statsAfter.withdrawableEarnings)).toEqual('3.0')

        // other members remain unaffected
        expect(formatEther(stats2Before.totalEarnings)).toEqual('2.0')
        expect(formatEther(stats2Before.withdrawableEarnings)).toEqual('2.0')
        expect(formatEther(stats2After.totalEarnings)).toEqual('2.0')
        expect(formatEther(stats2After.withdrawableEarnings)).toEqual('2.0')
    }, 1500000)
})
