/**
 * Wrap fetch with default headers performing authentication if required.
 */
import pkg from '../package.json'
import type { Response } from 'node-fetch'
import fetch from 'node-fetch'
import type { Debugger} from './utils/log'
import { Debug, inspect } from './utils/log'

import { counterId } from './utils'

export enum ErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    UNKNOWN = 'UNKNOWN'
}

function getVersion() {
    // dev deps are removed for production build
    const hasDevDependencies = !!(pkg.devDependencies && Object.keys(pkg.devDependencies).length)
    const isProduction = process.env.NODE_ENV === 'production' || hasDevDependencies
    return `${pkg.version}${!isProduction ? 'dev' : ''}`
}

// hardcode this at module exec time as can't change
const versionString = getVersion()

export const DEFAULT_HEADERS = {
    'Data-Union-Client': `data-union-client-javascript/${versionString}`,
}

export class AuthFetchError extends Error {
    response?: Response
    body?: any
    code: ErrorCode
    errorCode: ErrorCode

    constructor(message: string, response?: Response, body?: unknown, errorCode?: ErrorCode) {
        const typePrefix = errorCode ? errorCode + ': ' : ''
        // add leading space if there is a body set
        const bodyMessage = body ? ` ${inspect(body)}` : ''
        super(typePrefix + message + bodyMessage)
        this.response = response
        this.body = body
        this.code = errorCode || ErrorCode.UNKNOWN
        this.errorCode = this.code

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export async function authRequest(
    url: string,
    opts?: any,
    // requireNewToken = false,
    debug?: Debugger,
    fetchFn: typeof fetch = fetch
): Promise<Response> {
    if (!debug) {
        const id = counterId('authResponse')
        debug = Debug('utils').extend(id) // eslint-disable-line no-param-reassign
    }

    const timeStart = Date.now()

    const options = {
        ...opts,
        headers: {
            ...DEFAULT_HEADERS,
            ...(opts && opts.headers),
        },
    }
    // add default 'Content-Type: application/json' header for all POST and PUT requests
    if (!options.headers['Content-Type'] && (options.method === 'POST' || options.method === 'PUT')) {
        options.headers['Content-Type'] = 'application/json'
    }

    debug('%s >> %o', url, opts)

    const response: Response = await fetchFn(url, opts)
    const timeEnd = Date.now()
    debug('%s << %d %s %s %s', url, response.status, response.statusText, Debug.humanize(timeEnd - timeStart))

    if (response.ok) {
        return response
    }

    // no more sessions since DU3
    // if ([400, 401].includes(response.status) && !requireNewToken) {
    //     debug('%d %s – revalidating session')
    //     return authRequest<T>(url, options, true)
    // }

    debug('%s – failed', url)
    const errorBody = await response.json()
    throw new Error(errorBody.error?.message
        ?? `Request ${debug.namespace} to ${url} returned with error code ${response.status}: ${JSON.stringify(errorBody)}`)
}

/** @internal */
export async function authFetch<ResponseType extends object>(
    url: string,
    opts?: unknown,
    // requireNewToken = false,
    debug?: Debugger,
    fetchFn?: typeof fetch
): Promise<ResponseType> {
    const id = counterId('authFetch')
    debug = debug || Debug('utils').extend(id) // eslint-disable-line no-param-reassign

    const response = await authRequest(url, opts, debug, fetchFn)
    // can only be ok response
    const body = await response.text()
    try {
        return JSON.parse(body || '{}')
    } catch (e) {
        debug('%s – failed to parse body: %s', url, e.stack)
        throw new AuthFetchError(e.message, response, body)
    }
}

