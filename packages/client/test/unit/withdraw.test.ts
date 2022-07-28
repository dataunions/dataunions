import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, deployDataUnion, getWallets } from './setup'

import type { DataUnionClientConfig } from '../../src/Config'
import type { DATAv2 } from '@streamr/data-v2'

describe('DataUnion withdrawX functions', () => {

    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let outsider: Wallet
    let duAddress: string
    let token: DATAv2
    let clientOptions: Partial<DataUnionClientConfig>
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
                rpcs: [{
                    url: ethereumUrl,
                    timeout: 30 * 1000
                }]
            }
        }
    })

    async function fundDataUnion() {
        await (await token.mint(await token.signer.getAddress(), parseEther('1'))).wait()
        await (await token.transferAndCall(duAddress, parseEther('1'), '0x')).wait()
    }

    describe('by the member itself', () => {
        it('to itself', async () => {
            const client = new DataUnionClient(clientOptions)
            const du = await client.getDataUnion(duAddress)

            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await du.withdrawAll()
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        }, 30000)

        it('to any address', async () => {
            const client = new DataUnionClient(clientOptions)
            const du = await client.getDataUnion(duAddress)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await du.withdrawAllTo(outsider.address)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        }, 30000)
    })

    describe('by someone else on the member\'s behalf', () => {

        it('to a member without signature', async () => {
            // TODO: use otherMember once it works, see ETH-321
            // const client = new DataUnionClient({ ...clientOptions, auth: { privateKey: outsider.privateKey } })
            const client = new DataUnionClient(clientOptions) // TODO: remove after ETH-321 is fixed
            const du = await client.getDataUnion(duAddress)

            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await du.withdrawAllToMember(member.address)
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        }, 30000)

        it("to anyone with member's signature", async () => {
            const memberClient = new DataUnionClient(clientOptions)
            const memberDU = await memberClient.getDataUnion(duAddress)
            const signature = await memberDU.signWithdrawAllTo(outsider.address)

            // TODO: use otherMember once it works, see ETH-321
            // const otherClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: otherMember.privateKey } })
            const otherClient = new DataUnionClient(clientOptions) // TODO: remove after ETH-321 is fixed
            const otherDU = await otherClient.getDataUnion(duAddress)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDU.withdrawAllToSigned(member.address, outsider.address, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        }, 30000)

        it("to anyone a specific amount with member's signature", async () => {
            const withdrawAmount = parseEther("0.1")

            const memberClient = new DataUnionClient(clientOptions)
            const memberDU = await memberClient.getDataUnion(duAddress)
            const signature = await memberDU.signWithdrawAmountTo(outsider.address, withdrawAmount)

            // TODO: use otherMember once it works, see ETH-321
            // const otherClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: otherMember.privateKey } })
            const otherClient = new DataUnionClient(clientOptions) // TODO: remove after ETH-321 is fixed
            const otherDU = await otherClient.getDataUnion(duAddress)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDU.withdrawAmountToSigned(member.address, outsider.address, withdrawAmount, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual(formatEther(withdrawAmount))
        }, 30000)
    })

    it('validates input addresses', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.getDataUnion(duAddress)
        await fundDataUnion()
        return Promise.all([
            expect(() => dataUnion.getWithdrawableEarnings('invalid-address')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.withdrawAllTo('invalid-address')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.signWithdrawAllTo('invalid-address')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.signWithdrawAmountTo('invalid-address', '123')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.withdrawAllToMember('invalid-address')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.withdrawAllToSigned('invalid-address', 'invalid-address', 'mock-signature')).rejects.toThrow(/invalid address/),
            expect(() => dataUnion.withdrawAmountToSigned('addr', 'addr', parseEther('1'), 'mock-signature')).rejects.toThrow(/invalid address/),
        ])
    }, 30000)
})
