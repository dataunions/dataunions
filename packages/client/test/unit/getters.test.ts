import { parseEther, formatEther } from '@ethersproject/units'
import { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig } from '../../src/Config'

import { deployContracts, getWallets } from './setup'
import type { DATAv2 } from '@streamr/data-v2'

describe('Simple DataUnion object getters', () => {

    let admin: Wallet
    let member: Wallet
    let clientOptions: DataUnionClientConfig
    let token: DATAv2
    beforeAll(async () => {
        [
            admin,
            member,
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
                name: 'dev1',
                chainId: 8996,
                rpcs: [{
                    url: ethereumUrl,
                    timeout: 30 * 1000
                }]
            }
        }
    })

    it('getTokenBalance', async () => {
        const client = new DataUnionClient(clientOptions)
        const balanceBefore = await client.getTokenBalance()
        await (await token.mint(member.address, parseEther('123'))).wait()
        const balanceAfter = await client.getTokenBalance(member.address)

        expect(formatEther(balanceBefore)).toEqual('0.0')
        expect(formatEther(balanceAfter)).toEqual('123.0')
    })

    it('getDataUnion fails for non-DU addresses', async () => {
        const client = new DataUnionClient(clientOptions)
        await expect(async () => client.getDataUnion('invalid-address')).rejects.toThrow(/invalid Ethereum address/)
        await expect(client.getDataUnion('0x2222222222222222222222222222222222222222')).rejects.toThrow(/not an Ethereum contract/)
        await expect(client.getDataUnion(member.address)).rejects.toThrow(/not an Ethereum contract/)
        await expect(client.getDataUnion(admin.address)).rejects.toThrow(/not an Ethereum contract/)
        await expect(client.getDataUnion(token.address)).rejects.toThrow(/not a Data Union/)
    })
})
