import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, deployDataUnion, getWallets } from './setup'

import debug from 'debug'
const log = debug('DataUnionClient:unit-tests:withdraw')

async function setup() {
    const [
        admin,
        member,
        otherMember,
        outsider
    ] = getWallets()
    const {
        token,
        dataUnionFactory,
        dataUnionTemplate,
        ethereumUrl
    } = await deployContracts(admin)
    const duContract = await deployDataUnion(dataUnionFactory, token)
    await (await duContract.addMembers([member.address, otherMember.address])).wait()

    async function fundDataUnion() {
        log("%o", (await duContract.getStats()).map((bn) => bn.toString()))
        await (await token.mint(await token.signer.getAddress(), parseEther('1'))).wait()
        await (await token.transferAndCall(duContract.address, parseEther('1'), '0x')).wait()
        log("%o", (await duContract.getStats()).map((bn) => bn.toString()))
    }

    async function getClientFor(wallet: Wallet) {
        return new DataUnionClient({
            // TODO: delete these if possible
            theGraphUrl: "10.200.10.1:8000/subgraphs/name/streamr-dev/network-contracts",
            restUrl: "http://localhost/api/v2",
            id: "lol",

            auth: {
                privateKey: wallet.privateKey
            },

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
            // _timeouts: {
            //     theGraph: {
            //         timeout: 10 * 1000,
            //         retryInterval: 500
            //     },
            //     httpFetch: {
            //         timeout: 30 * 1000,
            //         retryInterval: -1
            //     }
            // }
        })
    }

    return {
        getClientFor,
        fundDataUnion,
        duContract,
        admin,
        member,
        otherMember,
        outsider,
        token,
    }
}

describe('DataUnion withdrawX functions', () => {
    describe('by the member itself', () => {
        it('to itself', async () => {
            const { getClientFor, fundDataUnion, duContract, member, token } = await setup()
            const client = await getClientFor(member)
            const du = await client.getDataUnion(duContract.address)

            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await du.withdrawAll()
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        }, 30000)

        it('to any address', async () => {
            const { getClientFor, fundDataUnion, duContract, member, outsider, token } = await setup()
            const client = await getClientFor(member)
            const du = await client.getDataUnion(duContract.address)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await du.withdrawAllTo(outsider.address)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        })
    })

    describe('by someone else on the member\'s behalf', () => {

        it('to a member without signature', async () => {
            const { getClientFor, fundDataUnion, duContract, member, outsider, token } = await setup()
            const client = await getClientFor(outsider)
            const du = await client.getDataUnion(duContract.address)

            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await du.withdrawAllToMember(member.address)
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        })

        it("to anyone with member's signature", async () => {
            const { getClientFor, fundDataUnion, duContract, member, outsider, otherMember, token } = await setup()

            const memberClient = await getClientFor(member)
            const memberDU = await memberClient.getDataUnion(duContract.address)
            const signature = await memberDU.signWithdrawAllTo(otherMember.address)

            const otherClient = await getClientFor(otherMember)
            const otherDU = await otherClient.getDataUnion(duContract.address)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDU.withdrawAllToSigned(member.address, outsider.address, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        })

        it("to anyone a specific amount with member's signature", async () => {
            const withdrawAmount = parseEther("0.1")
            const { getClientFor, fundDataUnion, duContract, member, outsider, otherMember, token } = await setup()

            const memberClient = await getClientFor(member)
            const memberDU = await memberClient.getDataUnion(duContract.address)
            const signature = await memberDU.signWithdrawAllTo(otherMember.address)

            const otherClient = await getClientFor(otherMember)
            const otherDU = await otherClient.getDataUnion(duContract.address)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDU.withdrawAmountToSigned(member.address, outsider.address, withdrawAmount, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual(withdrawAmount)
        }, 3600000)
    })

    it('validates input addresses', async () => {
        const { getClientFor, member, duContract } = await setup()
        const client = await getClientFor(member)
        const dataUnion = await client.getDataUnion(duContract.address)
        return Promise.all([
            await expect(() => dataUnion.getWithdrawableEarnings('invalid-address')).rejects.toThrow('Invalid address'),
            // expectInvalidAddress(() => dataUnion.withdrawAllTo('invalid-address')),
            // expectInvalidAddress(() => dataUnion.signWithdrawAllTo('invalid-address')),
            // expectInvalidAddress(() => dataUnion.signWithdrawAmountTo('invalid-address', '123')),
            // expectInvalidAddress(() => dataUnion.withdrawAllToMember('invalid-address')),
            // expectInvalidAddress(() => dataUnion.withdrawAllToSigned('invalid-address', 'invalid-address', 'mock-signature')),
            // expectInvalidAddress(() => dataUnion.withdrawAmountToSigned('invalid-address', 'invalid-address', parseEther('1'), 'mock-signature')),
        ])
    })
})
