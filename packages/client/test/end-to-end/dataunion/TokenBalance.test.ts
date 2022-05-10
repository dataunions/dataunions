import type { ERC20 } from '@dataunions/contracts/typechain'
import { Wallet } from '@ethersproject/wallet'
import { parseEther } from 'ethers/lib/utils'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { createMockAddress, getRandomClient } from '../../test-utils/utils'
import { tokenAdminPrivateKey } from '../devEnvironment'

describe('Token', () => {
    let client: DataUnionClient
    let token: ERC20

    beforeAll(async () => {
        client = getRandomClient()
        const tokenAdminClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: tokenAdminPrivateKey
            }
        })
        token = tokenAdminClient.getToken()
    })

    it('getTokenBalance', async () => {
        const userWallet = new Wallet(createMockAddress())
        const balance1 = await client.getTokenBalance(userWallet.address)
        expect(balance1.toString()).toBe('0')
        const tx1 = await token.mint(userWallet.address, parseEther('123'))
        await tx1.wait()
        const balance2 = await client.getTokenBalance(userWallet.address)
        expect(balance2.toString()).toBe('123000000000000000000')
    })
})
