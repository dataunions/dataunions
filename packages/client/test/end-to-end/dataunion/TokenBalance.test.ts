import { parseEther } from 'ethers/lib/utils'
import { getRandomClient } from '../../test-utils/utils'
import { token, getTestWallet } from '../devEnvironment'

describe('Token', () => {
    it('getTokenBalance', async () => {
        const client = getRandomClient()
        const userWallet = getTestWallet(10)
        const balance1 = await client.getTokenBalance(userWallet.address)
        expect(balance1.toString()).toBe('0')
        const tx1 = await token.mint(userWallet.address, parseEther('123'))
        await tx1.wait()
        const balance2 = await client.getTokenBalance(userWallet.address)
        expect(balance2.toString()).toBe('123000000000000000000')
    })
})
