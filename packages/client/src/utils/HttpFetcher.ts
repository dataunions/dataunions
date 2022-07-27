import { Lifecycle, scoped } from 'tsyringe'
import type { Debugger } from 'debug'
import type { Response } from 'node-fetch'
import fetch from 'node-fetch'

import type { Context } from './Context'
import { instanceId } from './index'

@scoped(Lifecycle.ContainerScoped)
export class HttpFetcher {
    private readonly debug: Debugger

    constructor(
        context: Context,
    ) {
        this.debug = context.debug.extend(instanceId(this))
    }

    async fetch(url: string, init?: Record<string, unknown>): Promise<Response> {
        // eslint-disable-next-line no-underscore-dangle
        // const { timeout } = this.config._timeouts.httpFetch
        const timeout = 60 * 1000
        this.debug('fetching %s (timeout %d ms)', url, timeout)
        return fetch(url, {
            timeout,
            ...init
        } as any)
    }
}
