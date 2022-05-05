import debug from 'debug'
import { Wallet } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import 'reflect-metadata'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { getCreateClient } from '../../test-utils/utils'
import { dataUnionAdminPrivateKey, provider, tokenAdminPrivateKey } from '../devEnvironment'

const log = debug('DataUnionClient::DataUnion::integration-test-adminFee')

const adminWallet = new Wallet(dataUnionAdminPrivateKey, provider)

const tokenAdminClient = new DataUnionClient({
    ...ConfigTest,
    auth: {
        privateKey: tokenAdminPrivateKey
    }
})
const token = tokenAdminClient.getToken()

describe('DataUnion admin fee', () => {
    const createClient = getCreateClient()
    let adminClient: DataUnionClient

    beforeAll(async () => {
        log('Connecting to Ethereum networks, clientOptions: %O', ConfigTest)
        const network = await provider.getNetwork()
        log('Connected to network: %O', network)
        log(`Minting 100 tokens to ${adminWallet.address}`)
        const tx1 = await token.mint(adminWallet.address, parseEther('100'))
        await tx1.wait()
        adminClient = await createClient({
            auth: {
                privateKey: dataUnionAdminPrivateKey
            }
        })
    }, 10000)

    it('can set admin fee', async () => {
        const dataUnion = await adminClient.deployDataUnion()
        const oldFee = await dataUnion.getAdminFee()
        log(`DU owner: ${await dataUnion.getAdminAddress()}`)
        log(`Sending tx from ${await adminClient.getAddress()}`)
        const tr = await dataUnion.setAdminFee(0.1)
        log(`Transaction receipt: ${JSON.stringify(tr)}`)
        const newFee = await dataUnion.getAdminFee()
        expect(oldFee).toEqual(0)
        expect(newFee).toEqual(0.1)
    }, 150000)

    it('receives admin fees', async () => {
        const dataUnion = await adminClient.deployDataUnion()
        const tr = await dataUnion.setAdminFee(0.1)
        log(`Transaction receipt: ${JSON.stringify(tr)}`)

        const amount = parseEther('2')

        const balance1 = await token.balanceOf(adminWallet.address)
        log(`Token balance of ${adminWallet.address}: ${formatEther(balance1)} (${balance1.toString()})`)

        log(`Transferring ${amount} token-wei ${adminWallet.address}->${dataUnion.getAddress()}`)
        const txTokenToDU = await token.transfer(dataUnion.getAddress(), amount)
        await txTokenToDU.wait()

        const balance2 = await token.balanceOf(adminWallet.address)
        log(`Token balance of ${adminWallet.address}: ${formatEther(balance2)} (${balance2.toString()})`)

        expect(formatEther(balance2.sub(balance1))).toEqual('0.2')
    }, 150000)
})
