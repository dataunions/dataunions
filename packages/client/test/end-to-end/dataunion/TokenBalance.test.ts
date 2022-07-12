import type { IERC677 } from '@dataunions/contracts/typechain'
import { parseEther } from 'ethers/lib/utils'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { getRandomClient } from '../../test-utils/utils'
import { tokenAdminPrivateKey, getTestWallet } from '../devEnvironment'

describe('Token', () => {
    let client: DataUnionClient
    let token: IERC677

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
        const userWallet = getTestWallet(10)
        const balance1 = await client.getTokenBalance(userWallet.address)
        expect(balance1.toString()).toBe('0')
        const tx1 = await token.mint(userWallet.address, parseEther('123'))
        await tx1.wait()
        const balance2 = await client.getTokenBalance(userWallet.address)
        expect(balance2.toString()).toBe('123000000000000000000')
    })
})
