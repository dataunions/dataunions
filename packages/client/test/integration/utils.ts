import { writeHeapSnapshot } from 'v8'
import type { DependencyContainer } from 'tsyringe'

import fetch from 'node-fetch'
import { wait } from 'streamr-test-utils'
import { Wallet } from '@ethersproject/wallet'
import LeakDetector from 'jest-leak-detector'

import type { EthereumAddress } from '../../src/types'
import { DataUnionClient } from '../../src/DataUnionClient'
import { counterId, CounterId, AggregatedError, instanceId } from '../../src/utils'
import { Debug, format } from '../../src/utils/log'
import type { MaybeAsync } from '../../src/types'
import { ConfigTest } from '../../src/ConfigTest'

import type { Context } from '../../src/utils/Context'

const testDebugRoot = Debug('test')
const testDebug = testDebugRoot.extend.bind(testDebugRoot)

type EmptyFunction = () => Promise<void>;

export {
    testDebug as Debug
}

export function mockContext(): Context {
    const id = counterId('mockContext')
    return { id, debug: testDebugRoot.extend(id) }
}

export function uid(prefix?: string): string {
    return counterId(`p${process.pid}${prefix ? '-' + prefix : ''}`)
}

export async function fetchPrivateKeyWithGas(): Promise<string> {
    const response = await fetch(`http://key-server`, {
        timeout: 5 * 1000
    })

    if (!response.ok) {
        throw new Error(`fetchPrivateKeyWithGas failed ${response.status} ${response.statusText}: ${response.text()}`)
    }

    return response.text()
}

const TEST_REPEATS = (process.env.TEST_REPEATS) ? parseInt(process.env.TEST_REPEATS, 10) : 1

export function describeRepeats(msg: string, fn: EmptyFunction, describeFn = describe): void {
    for (let k = 0; k < TEST_REPEATS; k++) {
        // eslint-disable-next-line no-loop-func
        describe(msg, () => {
            describeFn(`test repeat ${k + 1} of ${TEST_REPEATS}`, fn)
        })
    }
}

describeRepeats.skip = (msg: string, fn: EmptyFunction) => {
    describe.skip(`${msg} – test repeat ALL of ${TEST_REPEATS}`, fn)
}

describeRepeats.only = (msg: string, fn: EmptyFunction) => {
    describeRepeats(msg, fn, describe.only)
}

// TODO: unused, remove
// export function getTestSetTimeout() {
//     const addAfter = addAfterFn()
//     return (callback: () => void, ms?: number) => {
//         const t = setTimeout(callback, ms)
//         addAfter(() => {
//             clearTimeout(t)
//         })
//         return t
//     }
// }

export function addAfterFn(): (fn: EmptyFunction) => void {
    const afterFns: EmptyFunction[] = []
    afterEach(async () => {
        const fns = afterFns.slice()
        afterFns.length = 0
        // @ts-expect-error
        AggregatedError.throwAllSettled(await Promise.allSettled(fns.map((fn) => fn())))
    })

    return (fn: EmptyFunction) => {
        afterFns.push(fn)
    }
}

export function createMockAddress(): string {
    return '0x000000000000000000000000000' + Date.now()
}

export function getRandomClient(): DataUnionClient {
    const wallet = new Wallet(`0x100000000000000000000000000000000000000012300000001${Date.now()}`)
    return new DataUnionClient({
        ...ConfigTest,
        auth: {
            privateKey: wallet.privateKey
        }
    })
}

export const expectInvalidAddress = (operation: () => Promise<any>) => {
    return expect(() => operation()).rejects.toThrow()
}

export const getCreateClient = (defaultOpts = {}, defaultParentContainer?: DependencyContainer) => {
    const addAfter = addAfterFn()

    return async function createClient(opts: any = {}, parentContainer?: DependencyContainer) {
        let key
        if (opts.auth && opts.auth.privateKey) {
            key = opts.auth.privateKey
        } else {
            key = await fetchPrivateKeyWithGas()
        }
        const c = new DataUnionClient({
            ...ConfigTest,
            auth: {
                privateKey: key,
            },
            ...defaultOpts,
            ...opts,
        }, defaultParentContainer ?? parentContainer)

        addAfter(async () => {
            await wait(0)
            if (!c) { return }
            c.debug('disconnecting after test >>')
            await c.destroy()
            c.debug('disconnecting after test <<')
        })

        return c
    }
}

/**
 * Write a heap snapshot file if WRITE_SNAPSHOTS env var is set.
 */
export function snapshot(): string {
    if (!process.env.WRITE_SNAPSHOTS) { return '' }
    testDebugRoot('heap snapshot >>')
    const value = writeHeapSnapshot()
    testDebugRoot('heap snapshot <<', value)
    return value
}

export class LeaksDetector {
    leakDetectors: Map<string, LeakDetector> = new Map()
    ignoredValues = new WeakSet()
    id = instanceId(this)
    debug = testDebug(this.id)
    seen = new WeakSet()
    didGC = false

    // temporary whitelist leaks in network code
    ignoredKeys = new Set([
        '/cachedNode',
        '/container',
        '/childContainer',
        'rovider/formatter',
        'chainProviders/0/formatter'
    ])

    private counter = CounterId(this.id, { maxPrefixes: 1024 })

    add(name: string, obj: unknown): void {
        if (!obj || typeof obj !== 'object') { return }

        if (this.ignoredValues.has(obj)) { return }

        this.resetGC()
        const leaksDetector = new LeakDetector(obj)
        // @ts-expect-error monkeypatching
        // eslint-disable-next-line no-underscore-dangle
        leaksDetector._runGarbageCollector = this.runGarbageCollectorOnce(leaksDetector._runGarbageCollector)
        this.leakDetectors.set(name, leaksDetector)
    }

    // returns a monkeypatch for leaksDetector._runGarbageCollector
    // that avoids running gc for every isLeaking check, only once.
    private runGarbageCollectorOnce(original: (...args: unknown[]) => void) {
        return (...args: unknown[]) => {
            if (this.didGC) {
                return
            }

            this.didGC = true
            original(...args)
        }
    }

    resetGC(): void {
        this.didGC = false
    }

    ignore(obj: unknown): void {
        if (!obj || typeof obj !== 'object') { return }
        this.ignoredValues.add(obj)
    }

    ignoreAll(obj: unknown): void {
        if (!obj || typeof obj !== 'object') { return }
        const seen = new Set()
        this.walk([], obj, (_path, value) => {
            if (seen.has(value)) { return false }
            seen.add(value)
            this.ignore(value)
            return undefined
        })
    }

    idToPaths = new Map<string, Set<string>>() // ids to paths
    objectToId = new WeakMap<object, string>() // single id for value

    getID(path: string[], value: any): string {
        if (this.objectToId.has(value)) {
            return this.objectToId.get(value)!
        }

        let id = (() => {
            if (value.id) { return value.id }
            const pathString = path.join('/')
            const constructor = value.constructor?.name
            const type = constructor === 'Object' ? undefined : constructor
            return pathString + (type ? `-${type}` : '')
        })()

        id = this.counter(id)
        this.objectToId.set(value, id)
        return id
    }

    protected walk(
        path: string[],
        obj: object,
        fn: (path: string[], obj: object, depth: number) => false | void,
        depth = 0
    ): void {
        if (!obj || typeof obj !== 'object') { return }

        if (depth > 10) { return }

        const doContinue = fn(path, obj, depth)

        if (doContinue === false) { return }

        if (Array.isArray(obj)) {
            obj.forEach((value, key) => {
                this.walk([...path, `${key}`], value, fn, depth + 1)
            })
            return
        }

        for (const [key, value] of Object.entries(obj)) {
            if (!value || typeof value !== 'object') { continue }

            this.walk([...path, `${key}`], value, fn, depth + 1)
        }
    }

    addAll(rootId: string, obj: object): void {
        this.walk([rootId], obj, (path, value) => {
            if (this.ignoredValues.has(value)) { return false }
            const pathString = path.join('/')
            for (const key of this.ignoredKeys) {
                if (pathString.includes(key)) { return false } // stop walking
            }

            const id = this.getID(path, value)
            const paths = this.idToPaths.get(id) || new Set()
            paths.add(pathString)
            this.idToPaths.set(id, paths)
            if (!this.seen.has(value)) {
                this.seen.add(value)
                this.add(id, value)
            }
            return undefined
        })
    }

    async getLeaks(): Promise<Record<string, string>> {
        this.debug('checking for leaks with %d items >>', this.leakDetectors.size)
        await wait(10) // wait a moment for gc to run?
        const outstanding = new Set<string>()
        this.resetGC()
        const tasks = [...this.leakDetectors.entries()].map(async ([key, d]) => {
            outstanding.add(key)
            const isLeaking = await d.isLeaking()
            outstanding.delete(key)
            return isLeaking ? key : undefined
        })
        await Promise.allSettled(tasks)
        const results = (await Promise.all(tasks)).filter(Boolean) as string[]

        const leaks = results.reduce((o, id) => Object.assign(o, {
            [id]: [...(this.idToPaths.get(id) || [])],
        }), {})

        this.debug('checking for leaks with %d items <<', this.leakDetectors.size)
        this.debug('%d leaks.', results.length)
        return leaks
    }

    async checkNoLeaks(): Promise<void> {
        const leaks = await this.getLeaks()
        const numLeaks = Object.keys(leaks).length
        if (numLeaks) {
            const msg = format('Leaking %d of %d items: %o', numLeaks, this.leakDetectors.size, leaks)
            this.clear()
            throw new Error(msg)
        }
    }

    async checkNoLeaksFor(id: string): Promise<void> {
        const leaks = await this.getLeaks()
        const numLeaks = Object.keys(leaks).length
        if (Object.keys(leaks).includes(id)) {
            const msg = format('Leaking %d of %d items, including id %s: %o', numLeaks, this.leakDetectors.size, id, leaks)
            this.clear()
            throw new Error(msg)
        }
    }

    clear(): void {
        this.seen = new WeakSet()
        this.ignoredValues = new WeakSet()
        this.leakDetectors.clear()
        this.didGC = false
    }
}

export async function sleep(ms: number = 0): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

/**
 * Wait until a condition is true
 * @param condition - wait until this callback function returns true
 * @param timeOutMs - stop waiting after that many milliseconds, -1 for disable
 * @param pollingIntervalMs - check condition between so many milliseconds
 * @param failedMsgFn - append the string return value of this getter function to the error message, if given
 * @return the (last) truthy value returned by the condition function
 */
export async function until(
    condition: MaybeAsync<() => boolean>,
    timeOutMs = 10000,
    pollingIntervalMs = 100,
    failedMsgFn?: () => string
): Promise<void> {
    // condition could as well return any instead of boolean, could be convenient
    // sometimes if waiting until a value is returned. Maybe change if such use
    // case emerges.
    const err = new Error(`Timeout after ${timeOutMs} milliseconds`)
    let isTimedOut = false
    let t!: ReturnType<typeof setTimeout>
    if (timeOutMs > 0) {
        t = setTimeout(() => { isTimedOut = true }, timeOutMs)
    }

    try {
        // Promise wrapped condition function works for normal functions just the same as Promises
        let wasDone = false
        while (!wasDone && !isTimedOut) { // eslint-disable-line no-await-in-loop
            wasDone = await Promise.resolve().then(condition) // eslint-disable-line no-await-in-loop
            if (!wasDone && !isTimedOut) {
                await sleep(pollingIntervalMs) // eslint-disable-line no-await-in-loop
            }
        }

        if (isTimedOut) {
            if (failedMsgFn) {
                err.message += ` ${failedMsgFn()}`
            }
            throw err
        }
    } finally {
        clearTimeout(t)
    }
}

export const createEthereumAddressCache = (): { getAddress: (privateKey: string) => EthereumAddress } => {
    const cache: Map<string, EthereumAddress> = new Map()
    return {
        getAddress: (privateKey: string): EthereumAddress => {
            let address = cache.get(privateKey)
            if (address === undefined) {
                // eslint-disable-next-line prefer-destructuring
                address = new Wallet(privateKey).address
                cache.set(privateKey, address)
            }
            return address
        }
    }
}

/*
 * Generic multimap: a key which maps to multiple valuess.
 * The values is an array
 * -> when we query the data, we get it back in the same order
 * -> an array may contain duplicates, if same value is added multiple times
 *    (we could implement a Multiset class if we need a different kind of duplication handling)
 *
 * TODO: Move this class to a streamr-utils package when we create that? Also implement some
 * unit tests if this is not just a test helper class.
 */
export class Multimap<K, V> {
    private readonly values: Map<K, V[]> = new Map()

    get(key: K): V[] {
        return this.values.get(key) ?? []
    }

    has(key: K, value: V): boolean {
        const items = this.values.get(key)
        if (items !== undefined) {
            return items.includes(value)
            // eslint-disable-next-line no-else-return
        } else {
            return false
        }
    }

    add(key: K, value: V): void {
        this.values.set(key, this.get(key).concat(value))
    }

    addAll(key: K, values: V[]): void {
        this.values.set(key, this.get(key).concat(values))
    }

    remove(key: K, value: V): void {
        const items = this.values.get(key)
        if (items !== undefined) {
            const newItems = items.filter((i) => i !== value)
            if (newItems.length > 0) {
                this.values.set(key, newItems)
            } else {
                this.values.delete(key)
            }
        }
    }

    removeAll(key: K, values: V[]): void {
        values.forEach((value) => this.remove(key, value))
    }

    keys(): K[] {
        return Array.from(this.values.keys())
    }
}
