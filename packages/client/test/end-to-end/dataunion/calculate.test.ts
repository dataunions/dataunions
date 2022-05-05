import { expectInvalidAddress, getRandomClient } from '../../test-utils/utils'

// This test will fail when new docker images are pushed with updated DU smart contracts
// -> generate new codehashes for calculateDataUnionMainnetAddress() and calculateDataUnionSidechainAddress()

describe('DataUnion calculate', () => {
    it('getDataUnion fails for bad addresses', async () => {
        const client = getRandomClient()
        await expectInvalidAddress(async () => client.getDataUnion('invalid-address'))
        await expect(client.getDataUnion('0x2222222222222222222222222222222222222222'))
            .rejects
            .toThrow('0x2222222222222222222222222222222222222222 is not a Data Union!')
    })
})
