import { Wallet } from '@ethersproject/wallet'
import { parseEther, formatEther } from '@ethersproject/units'
import type { ContractReceipt } from '@ethersproject/contracts'
import type { BigNumber } from '@ethersproject/bignumber'

import { authFetch } from '../../../src/authFetch'
import { ConfigTest } from '../../../src/ConfigTest'
import { MemberStatus } from '../../../src/DataUnion'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { getEndpointUrl } from '../../../src/utils'
import { expectInvalidAddress } from '../../test-utils/utils'
import type { AmbMessageHash, DataUnion} from '../../../src/DataUnion'
import type { EthereumAddress } from '../../../src/types'

import { dataUnionAdminPrivateKey, provider, token } from '../devEnvironment'

import debug from 'debug'
const log = debug('DataUnionClient::DataUnion::integration-test-withdraw')

// const provider = new providers.JsonRpcProvider(ConfigTest.dataUnionChainRPCs.rpcs[0])
// const providerMainnet = new providers.JsonRpcProvider(ConfigTest.mainChainRPCs.rpcs[0])
const adminWallet = new Wallet(dataUnionAdminPrivateKey, provider)

let testWalletId = 1000000 // ensure fixed length as string

// TODO: to speed up this test, try re-using the data union?
let validDataUnion: DataUnion | undefined // use this in a test that only wants a valid data union but doesn't mutate it
async function getDataUnion(): Promise<DataUnion> {
    return validDataUnion || new DataUnionClient(ConfigTest).deployDataUnion()
}

async function testWithdraw(
    withdraw: (
        dataUnionAddress: EthereumAddress,
        memberClient: DataUnionClient,
        memberWallet: Wallet,
        adminClient: DataUnionClient
    ) => Promise<ContractReceipt | AmbMessageHash | null>,
    recipientAddress?: EthereumAddress,
    // requiresMainnetETH: boolean,
    expectedWithdrawAmount?: BigNumber,
) {
    log('Connecting to Ethereum networks, clientOptions: %O', ConfigTest)
    const network = await provider.getNetwork()
    log('Connected to network: %O', network)

    log('Minting 100 tokens to %s', adminWallet.address)
    const tx1 = await token.mint(adminWallet.address, parseEther('100'))
    await tx1.wait()

    const adminClient = new DataUnionClient({
        ...ConfigTest,
        auth: {
            privateKey: dataUnionAdminPrivateKey
        }
    })

    const dataUnion = await adminClient.deployDataUnion()
    validDataUnion = dataUnion // save for later re-use
    const secret = await dataUnion.createSecret('test secret')
    log('DataUnion %s is ready to roll', dataUnion.getAddress())
    // dataUnion = await adminClient.getDataUnionContract({dataUnion: "0xd778CfA9BB1d5F36E42526B2BAFD07B74b4066c0"})

    testWalletId += 1
    const memberWallet = new Wallet(`0x100000000000000000000000000000000000000012300000000000001${testWalletId}`, provider)
    const recipient = recipientAddress || memberWallet.address
    const sendTx = await adminWallet.sendTransaction({ to: memberWallet.address, value: parseEther('0.1') })
    await sendTx.wait()
    log('Sent 0.1 ETH to %s', memberWallet.address)

    // if (requiresMainnetETH) {
    //     const send2Tx = await adminWallet.sendTransaction({ to: memberWallet.address, value: parseEther('0.1') })
    //     await send2Tx.wait()
    //     log('Sent 0.1 mainnet-ETH to %s', memberWallet.address)
    // }

    const memberClient = new DataUnionClient({
        ...ConfigTest,
        auth: {
            privateKey: memberWallet.privateKey
        }
    })
    const dataUnionMember = await memberClient.getDataUnion(dataUnion.getAddress())

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
    const res1 = await dataUnion.join(secret)
    log('Admin joined data union %O', res1)
    const res2 = await dataUnionMember.join(secret)
    log('Member joined data union %O', res2)

    async function logBalance(owner: string, address: EthereumAddress) {
        const balance = await token.balanceOf(address)
        log('%s (%s) mainnet token balance: %s (%s)', owner, address, formatEther(balance), balance.toString())
    }

    const amount = parseEther('1')
    const duEarningsBefore = await dataUnion.contract.totalEarnings()

    await logBalance('Data union', dataUnion.getAddress())
    await logBalance('Admin', adminWallet.address)

    log('Transferring %s token-wei %s->%s', amount, adminWallet.address, dataUnion.getAddress())
    const txTokenToDU = await token.transfer(dataUnion.getAddress(), amount)
    await txTokenToDU.wait()

    await logBalance('Data union', dataUnion.getAddress())
    await logBalance('Admin', adminWallet.address)

    log('DU member count: %d', await dataUnion.contract.activeMemberCount())

    log('Confirmed tokens arrived, DU balance: %s -> %s', duEarningsBefore, await dataUnion.contract.totalEarnings())

    const tx3 = await dataUnion.contract.refreshRevenue()
    const tr3 = await tx3.wait()
    log('refreshRevenue returned %O', tr3)
    log('DU totalEarnings: %O', await dataUnion.contract.totalEarnings())

    await logBalance('Data union', dataUnion.getAddress())
    await logBalance('Admin', adminWallet.address)

    const stats = await dataUnion.getMemberStats(memberWallet.address)
    log('Stats: %O', stats)

    const getRecipientBalance = async () => (
        memberClient.getTokenBalance(recipient)
    )

    const balanceBefore = await getRecipientBalance()
    log('Balance before: %s. Withdrawing tokens...', balanceBefore)

    // test setup done, do the withdraw
    const ret = await withdraw(dataUnion.getAddress(), memberClient, memberWallet, adminClient)

    log('Tokens withdrawn, return value: %O', ret)

    // "skip waiting" or "without checking the recipient account" case

    const balanceAfter = await getRecipientBalance()
    const balanceIncrease = balanceAfter.sub(balanceBefore)

    expect(stats.status).toEqual(MemberStatus.ACTIVE)
    expect(stats.earningsBeforeLastJoin.toNumber()).toEqual(0)
    expect(stats.totalEarnings.toString()).toEqual('1000000000000000000')
    expect(stats.withdrawableEarnings.toString()).toEqual('1000000000000000000')
    expect(balanceIncrease.toString()).toEqual((expectedWithdrawAmount || amount).toString())
}

describe('DataUnion withdrawX functions', () => {
    describe('by member', () => {
        it('to itself', async () => {
            await testWithdraw(async (dataUnionAddress, memberClient) => {
                const du = await memberClient.getDataUnion(dataUnionAddress)
                return await du.withdrawAll()
            })
        }, 3600000)

        it('to any address', () => {
            testWalletId += 1
            const outsiderWallet = new Wallet(`0x100000000000000000000000000000000000000012300000002${testWalletId}`, provider)
            return testWithdraw(async (dataUnionAddress, memberClient) => {
                const du = await memberClient.getDataUnion(dataUnionAddress)
                return du.withdrawAllTo(outsiderWallet.address)
            }, outsiderWallet.address)
        }, 3600000)

    })

    describe('by admin', () => {

        it('to member without signature', async () => {
            await testWithdraw(async (dataUnionAddress, memberClient, memberWallet) => {
                const du = await memberClient.getDataUnion(dataUnionAddress)
                return du.withdrawAllToMember(memberWallet.address)
            })
        }, 3600000)

        it("to anyone with member's signature", async () => {
            testWalletId += 1
            const member2Wallet = new Wallet(`0x100000000000000000000000000000000040000000000012300000007${testWalletId}`, provider)
            await testWithdraw(async (dataUnionAddress, memberClient, memberWallet, adminClient) => {
                const duMember = await memberClient.getDataUnion(dataUnionAddress)
                const duAdmin = await adminClient.getDataUnion(dataUnionAddress)
                const signature = await duMember.signWithdrawAllTo(member2Wallet.address)
                return duAdmin.withdrawAllToSigned(memberWallet.address, member2Wallet.address, signature)
            }, member2Wallet.address)
        }, 3600000)

        it("to anyone a specific amount with member's signature", async () => {
            testWalletId += 1
            const withdrawAmount = parseEther('0.5')
            const member2Wallet = new Wallet(`0x100000000000000000000000000000000040000000000012300000008${testWalletId}`, provider)
            return testWithdraw(async (dataUnionAddress, memberClient, memberWallet, adminClient) => {
                const duMember = await memberClient.getDataUnion(dataUnionAddress)
                const duAdmin = await adminClient.getDataUnion(dataUnionAddress)
                const signature = await duMember.signWithdrawAmountTo(member2Wallet.address, withdrawAmount)
                return duAdmin.withdrawAmountToSigned(memberWallet.address, member2Wallet.address, withdrawAmount, signature)
            }, member2Wallet.address, withdrawAmount)
        }, 3600000)
    })
})

it('validates input addresses', async () => {
    const dataUnion = await getDataUnion()
    return Promise.all([
        expectInvalidAddress(() => dataUnion.getWithdrawableEarnings('invalid-address')),
        expectInvalidAddress(() => dataUnion.withdrawAllTo('invalid-address')),
        expectInvalidAddress(() => dataUnion.signWithdrawAllTo('invalid-address')),
        expectInvalidAddress(() => dataUnion.signWithdrawAmountTo('invalid-address', '123')),
        expectInvalidAddress(() => dataUnion.withdrawAllToMember('invalid-address')),
        expectInvalidAddress(() => dataUnion.withdrawAllToSigned('invalid-address', 'invalid-address', 'mock-signature')),
        expectInvalidAddress(() => dataUnion.withdrawAmountToSigned('invalid-address', 'invalid-address', parseEther('1'), 'mock-signature')),
    ])
})
