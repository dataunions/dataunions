jest.mock('node-fetch')

import fetch from 'node-fetch'
import { ConfigTest } from '../../../src/ConfigTest'
import { DataUnionClient } from '../../../src/DataUnionClient'
import { createMockAddress } from '../../test-utils/utils'

describe('authFetch', () => {
    let client: DataUnionClient
    afterEach(async () => {
        if (!client) { return }
        await client.destroy()
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    it('sends Streamr-Client header', async () => {
        const realFetch = jest.requireActual('node-fetch')
        // @ts-expect-error
        fetch.Response = realFetch.Response
        // @ts-expect-error
        fetch.Promise = realFetch.Promise
        // @ts-expect-error
        fetch.Request = realFetch.Request
        // @ts-expect-error
        fetch.Headers = realFetch.Headers
        // @ts-expect-error
        fetch.mockImplementation(realFetch)
        client = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: createMockAddress()
            },
        })
        expect(fetch).not.toHaveBeenCalled() // will get called in background though (questionable behaviour)
        // @ts-expect-error
        await client.session.getSessionToken() // this ensures authentication completed
        expect(fetch).toHaveBeenCalled()
        // @ts-expect-error
        fetch.mock.calls.forEach(([url, opts]) => {
            expect(typeof url).toEqual('string')
            expect(opts).toMatchObject({
                headers: {
                    'Streamr-Client': expect.stringMatching('streamr-client-javascript'),
                },
            })
        })
    })
})
