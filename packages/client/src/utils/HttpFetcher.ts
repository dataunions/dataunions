import { inject, Lifecycle, scoped } from 'tsyringe'
import type { Debugger } from 'debug'
import type { Response } from 'node-fetch'
import fetch from 'node-fetch'

import type { StrictDataUnionClientConfig } from '../Config'
import { ConfigInjectionToken } from '../Config'
import type { Context } from './Context'
import { instanceId } from './index'

@scoped(Lifecycle.ContainerScoped)
export class HttpFetcher {
    private readonly debug: Debugger

    constructor(
        context: Context,
        @inject(ConfigInjectionToken.Root) private config: StrictDataUnionClientConfig
    ) {
        this.debug = context.debug.extend(instanceId(this))
    }

    async fetch(url: string, init?: Record<string, unknown>): Promise<Response> {
        // eslint-disable-next-line no-underscore-dangle
        const { timeout } = this.config._timeouts.httpFetch
        this.debug('fetching %s (timeout %d ms)', url, timeout)
        return fetch(url, {
            timeout,
            ...init
        } as any)
    }
}
