import { Wallet } from '@ethersproject/wallet'
import { BigNumber } from '@ethersproject/bignumber'
import { parseEther } from '@ethersproject/units'
import { Contract } from '@ethersproject/contracts'

import { authFetch } from '../../../src/authFetch'
import { createStrictConfig } from '../../../src/Config'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnion } from '../../../src/DataUnion'
import DataUnionAPI from '../../../src/DataUnionAPI'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { getEndpointUrl } from '../../../src/utils'
import { dataUnionAdminPrivateKey, provider } from '../devEnvironment'

import * as DataUnionTemplateJson from '@dataunions/contracts/artifacts/contracts/unichain/DataUnionTemplate.sol/DataUnionTemplate.json'
import type { DataUnionTemplate } from '@dataunions/contracts/typechain'

import debug from 'debug'
const log = debug('DataUnionClient::DataUnion::integration-test-signature')

describe('DataUnion signature', () => {

    it('check validity', async () => {
        const adminClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: dataUnionAdminPrivateKey
            }
        })
        const dataUnion = await adminClient.deployDataUnion()
        const dataUnionAddress = dataUnion.getAddress()
        const secret = await dataUnion.createSecret('test secret')
        log(`DataUnion ${dataUnionAddress} is ready to roll`)

        const memberWallet = new Wallet(`0x100000000000000000000000000000000000000012300000001${Date.now()}`, provider)
        const member2Wallet = new Wallet(`0x100000000000000000000000000000000000000012300000002${Date.now()}`, provider)

        const memberClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: memberWallet.privateKey
            }
        } as any)
        const memberDataUnion = await memberClient.getDataUnion(dataUnionAddress)

        // product is needed for join requests to analyze the DU version
        const createProductUrl = getEndpointUrl(ConfigTest.restUrl, 'products')
        await authFetch(createProductUrl, {
            method: 'POST',
            body: JSON.stringify({
                beneficiaryAddress: dataUnionAddress,
                type: 'DATAUNION',
                dataUnionVersion: 2
            }),
            // @ts-expect-error
            session: adminClient.session,
        })
        await memberDataUnion.join(secret)

        const dataUnionContract = adminClient.getTemplate(dataUnion.getAddress(), provider)
        const token = adminClient.getToken()

        // make a "full" sidechain contract object that has all functions, not just those required by DataUnionClient
        // const sidechainContract = new Contract(sidechainContractLimited.address, DataUnionSidechain.abi, adminWalletSidechain)

        const signature = await memberDataUnion.signWithdrawAllTo(member2Wallet.address)
        const signature2 = await memberDataUnion.signWithdrawAmountTo(member2Wallet.address, parseEther('1'))
        const signature3 = await memberDataUnion.signWithdrawAmountTo(member2Wallet.address, 3000000000000000) // 0.003 tokens

        const isValid = await dataUnionContract.signatureIsValid(memberWallet.address, member2Wallet.address, '0', signature) // '0' = all earnings
        const isValid2 = await dataUnionContract.signatureIsValid(memberWallet.address, member2Wallet.address, parseEther('1'), signature2)
        const isValid3 = await dataUnionContract.signatureIsValid(memberWallet.address, member2Wallet.address, '3000000000000000', signature3)
        log(`Signature for all tokens ${memberWallet.address} -> ${member2Wallet.address}: ${signature}, checked ${isValid ? 'OK' : '!!!BROKEN!!!'}`)
        log(`Signature for 1 token ${memberWallet.address} -> ${member2Wallet.address}: ${signature2}, checked ${isValid2 ? 'OK' : '!!!BROKEN!!!'}`)
        // eslint-disable-next-line max-len
        log(`Signature for 0.003 tokens ${memberWallet.address} -> ${member2Wallet.address}: ${signature3}, checked ${isValid3 ? 'OK' : '!!!BROKEN!!!'}`)
        log(`sidechainDU(${dataUnionContract.address}) token bal ${await token.balanceOf(dataUnionContract.address)}`)

        expect(isValid).toBe(true)
        expect(isValid2).toBe(true)
        expect(isValid3).toBe(true)
    }, 100000)

    it('create signature', async () => {
        const opts = {
            auth: {
                privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111'
            }
        }
        const client = new DataUnionClient(opts)
        const template = new Contract('0x2222222222222222222222222222222222222222', DataUnionTemplateJson.abi, provider) as DataUnionTemplate
        const dataUnion = new DataUnion(
            template,
            new DataUnionAPI(client, null!, createStrictConfig({
                ...ConfigTest,
                auth: {
                    privateKey: dataUnionAdminPrivateKey
                }
            }))
        )
        const to = '0x3333333333333333333333333333333333333333'
        const withdrawn = BigNumber.from('4000000000000000')
        const amounts = [5000000000000000, '5000000000000000', BigNumber.from('5000000000000000')]

        const signer = new Wallet(opts.auth.privateKey)
        // eslint-disable-next-line no-underscore-dangle
        const signaturePromises = amounts.map((amount) => dataUnion._createWithdrawSignature(amount, to, withdrawn, signer))
        const actualSignatures = await Promise.all(signaturePromises)
        const expectedSignature = '0xcaec648e19b71df9e14ae7c313c7a2b268356648bcfd5c5a0e82a76865d1e4a500890d71e7aa6e2dbf961251329b4528915036f1c484db8ee4ce585fd7cb05531c' // eslint-disable-line max-len
        expect(actualSignatures.every((actual) => actual === expectedSignature))
    })
})
