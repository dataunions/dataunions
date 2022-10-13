/**
 * Wrap fetch with default headers performing authentication if required.
 */
import pkg from '../package.json'
import type { Response } from 'node-fetch'
import fetch from 'node-fetch'

import { debug } from 'debug'
const log = debug('dataunions:authFetch')

/**
 * Generates counter-based ids.
 * Basically lodash.uniqueid but per-prefix.
 * Not universally unique.
 * Generally useful for tracking instances.
 *
 * Careful not to use too many prefixes since it needs to hold all prefixes in memory
 * e.g. don't pass new uuid as a prefix
 *
 * counterId('test') => test.0
 * counterId('test') => test.1
 */
const CounterId = (rootPrefix?: string, { maxPrefixes = 256 }: { maxPrefixes?: number } = {}) => {
    const SEPARATOR = '-'
    let counts: { [prefix: string]: number } = {} // possible we could switch this to WeakMap and pass functions or classes.
    let didWarn = false
    const counterIdFn = (prefix = 'ID', separator = SEPARATOR) => {
        // pedantic: wrap around if count grows too large
        counts[prefix] = (counts[prefix] + 1 || 0) % Number.MAX_SAFE_INTEGER

        // warn once if too many prefixes
        if (!didWarn) {
            const numTracked = Object.keys(counts).length
            if (numTracked > maxPrefixes) {
                didWarn = true
                console.warn(`counterId should not be used for a large number of unique prefixes: ${numTracked} > ${maxPrefixes}`)
            }
        }

        // connect prefix with separator
        return [rootPrefix, prefix, counts[prefix]]
            .filter((v) => v != null) // remove {root}Prefix if not set
            .join(separator)
    }

    /**
     * Clears counts for prefix or all if no prefix supplied.
     *
     * @param {string?} prefix
     */
    counterIdFn.clear = (...args: [string] | []) => {
        // check length to differentiate between clear(undefined) & clear()
        if (args.length) {
            const [prefix] = args
            delete counts[prefix]
        } else {
            // clear all
            counts = {}
        }
    }
    return counterIdFn
}

const counterId = CounterId()

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
        const bodyMessage = body ? ` ${JSON.stringify(body)}` : ''
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
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    opts?: any,
    // requireNewToken = false,
    fetchFn: typeof fetch = fetch
): Promise<Response> {

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

    log('%s >> %o', url, opts)

    const response: Response = await fetchFn(url, opts)
    const timeEnd = Date.now()
    log('%s << %d %s %s %s ms', url, response.status, response.statusText, timeEnd - timeStart)

    if (response.ok) {
        return response
    }

    // no more sessions since DU3
    // if ([400, 401].includes(response.status) && !requireNewToken) {
    //     log('%d %s – revalidating session')
    //     return authRequest<T>(url, options, true)
    // }

    log('%s – failed', url)
    const errorBody = await response.json()
    throw new Error(errorBody.error?.message
        ?? `Request ${url} returned with error code ${response.status}: ${JSON.stringify(errorBody)}`)
}

/** @internal */
export async function authFetch<ResponseType extends object>(
    url: string,
    opts?: unknown,
    // requireNewToken = false,
    fetchFn?: typeof fetch
): Promise<ResponseType> {
    const response = await authRequest(url, opts, fetchFn)
    // can only be ok response
    const body = await response.text()
    try {
        return JSON.parse(body || '{}')
    } catch (e) {
        log('%s – failed to parse body: %s', url, (e as Error).stack)
        throw new AuthFetchError((e as Error).message, response, body)
    }
}

