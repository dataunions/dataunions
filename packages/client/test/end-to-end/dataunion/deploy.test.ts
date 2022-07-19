import debug from 'debug'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { createMockAddress } from '../../test-utils/utils'
import { dataUnionAdminPrivateKey } from '../devEnvironment'

const log = debug('DataUnionClient::DataUnion::integration-test-deploy')

describe('DataUnion deploy', () => {

    let adminClient: DataUnionClient

    beforeAll(async () => {
        log('ClientOptions: %O', ConfigTest)
        adminClient = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: dataUnionAdminPrivateKey
            }
        })
    }, 60000)

    describe('owner', () => {
        it('not specified: defaults to deployer', async () => {
            const dataUnion = await adminClient.deployDataUnion()
            expect(await dataUnion.getAdminAddress()).toBe(await adminClient.getAddress())
        }, 60000)

        it('specified', async () => {
            const owner = createMockAddress()
            const dataUnion = await adminClient.deployDataUnion({ owner })
            expect(await dataUnion.getAdminAddress()).toBe(owner)
        }, 60000)

        it('invalid', async () => {
            await expect(async () => (
                adminClient.deployDataUnion({ owner: 'foobar' })
            )).rejects.toThrow('invalid address')
        }, 60000)

    })
})
