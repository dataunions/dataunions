import { parseEther, formatEther } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

import { deployContracts, deployDataUnion, getWallets } from './setup'

import type { DataUnionClientConfig } from '../../src/Config'
import type { DATAv2 } from '@streamr/data-v2'

import debug from 'debug'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
const log = debug('DataUnionClient:unit-tests:adminFee')

describe('DataUnion admin fee', () => {

    let admin: Wallet
    let user: Wallet
    let clientOptions: DataUnionClientConfig
    let token: DATAv2
    beforeAll(async () => {
        [
            admin,
            user
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
                privateKey: user.privateKey
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

    async function fundDataUnion(duAddress: string, amountWei: BigNumberish) {
        await (await token.mint(await token.signer.getAddress(), amountWei)).wait()
        await (await token.transferAndCall(duAddress, amountWei, '0x')).wait()
    }

    it('can set admin fee', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.deployDataUnion()
        const oldFee = await dataUnion.getAdminFee()
        log(`DU owner: ${await dataUnion.getAdminAddress()}`)
        log(`Sending tx from ${await client.getAddress()}`)
        const tr = await dataUnion.setAdminFee(0.1)
        log(`Transaction events: ${JSON.stringify(tr.events!.map((e) => e.event))}`)
        const newFee = await dataUnion.getAdminFee()
        expect(oldFee).toEqual(0)
        expect(newFee).toEqual(0.1)
    }, 30000)

    it('receives admin fees', async () => {
        const client = new DataUnionClient(clientOptions)
        const dataUnion = await client.deployDataUnion()
        await dataUnion.addMembers(["0x0000000000000000000000000000000000000001"])
        await dataUnion.setAdminFee(0.1)
        await fundDataUnion(dataUnion.getAddress(), parseEther('1'))
        expect(formatEther(await dataUnion.getWithdrawableEarnings(user.address))).toEqual('0.1')
    }, 30000)

    // TODO: tests for DU fees
})
