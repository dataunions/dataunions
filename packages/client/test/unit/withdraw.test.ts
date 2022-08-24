import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, getWallets } from './setup'

import type { DATAv2 } from '@streamr/data-v2'
import type { DataUnion } from '../../src/DataUnion'
import type { DataUnionClientConfig } from '../../src/Config'

describe('DataUnion withdrawX functions', () => {

    let admin: Wallet
    let member: Wallet
    let otherMember: Wallet
    let token: DATAv2
    let dataUnion: DataUnion
    let otherDataUnion: DataUnion
    let outsider: Wallet
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
        const adminClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: admin.privateKey } })
        const adminDataUnion = await adminClient.deployDataUnion()
        await adminDataUnion.addMembers([member.address, otherMember.address])

        const client = new DataUnionClient(clientOptions)
        dataUnion = await client.getDataUnion(adminDataUnion.getAddress())

        const otherClient = new DataUnionClient({ ...clientOptions, auth: { privateKey: otherMember.privateKey } })
        otherDataUnion = await otherClient.getDataUnion(dataUnion.getAddress())
    })

    async function fundDataUnion() {
        await (await token.mint(await token.signer.getAddress(), parseEther('1'))).wait()
        await (await token.transferAndCall(dataUnion.getAddress(), parseEther('1'), '0x')).wait()
    }

    describe('by the member itself', () => {
        it('to itself', async () => {
            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await dataUnion.withdrawAll()
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)
            expect(formatEther(balanceChange)).toEqual("0.5")
        })

        it('to any address', async () => {
            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await dataUnion.withdrawAllTo(outsider.address)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)
            expect(formatEther(balanceChange)).toEqual("0.5")
        })
    })

    describe('by someone else on the member\'s behalf', () => {

        // TODO: for some reason this is actually blocked in the smart contract. Why? It used to be possible.
        it.skip('to a member without signature', async () => {
            const balanceBefore = await token.balanceOf(member.address)
            await fundDataUnion()
            await otherDataUnion.withdrawAllToMember(member.address)
            const balanceChange = (await token.balanceOf(member.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        })

        it("to anyone with member's signature", async () => {
            const signature = await dataUnion.signWithdrawAllTo(outsider.address)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDataUnion.withdrawAllToSigned(member.address, outsider.address, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual("0.5")
        })

        it("to anyone a specific amount with member's signature", async () => {
            const withdrawAmount = parseEther("0.1")
            const signature = await dataUnion.signWithdrawAmountTo(outsider.address, withdrawAmount)

            const balanceBefore = await token.balanceOf(outsider.address)
            await fundDataUnion()
            await otherDataUnion.withdrawAmountToSigned(member.address, outsider.address, withdrawAmount, signature)
            const balanceChange = (await token.balanceOf(outsider.address)).sub(balanceBefore)

            expect(formatEther(balanceChange)).toEqual(formatEther(withdrawAmount))
        })
    })

    it('validates input addresses', async () => {
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
    })
})
