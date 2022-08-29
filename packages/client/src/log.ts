/**
 * Exposes customised Debug and inspect functions.
 */
import util from 'util'
import Debug from 'debug'

// add global support for pretty millisecond formatting with %n
Debug.formatters.n = (v: any) => {
    if (v == null || Number.isNaN(v)) { return String(v) }
    return Debug.humanize(v)
}

export const DEFAULT_INSPECT_OPTS = {
    maxStringLength: 256
}

declare const process: any

const D: any = Debug

// Override default formatters for environments with defined `Debug.inspectOpts` (only node atm).
if ('inspectOpts' in D) {
    // monkeypatch default log function to use current `inspectOpts`.  This
    // ensures values logged without placeholders e.g. %o, %O will have the
    // same inspect options applied. Without this only values with a
    // placeholder will use the `inspectOpts` config.
    // e.g.
    // `debug('msg', obj)` should use same `inspectOpts` as `debug('msg %O', msg)`
    D.log = function log(...args: any[]) {
        const { inspectOpts, useColors } = this

        if (inspectOpts.colors === undefined) {
            inspectOpts.colors = useColors // need this to get colours when no placeholder
        }

        return process.stderr.write(formatWithOptions({
            ...inspectOpts,
        }, ...args) + '\n')
    }

    // mutate inspectOpts rather than replace, otherwise changes are lost
    Object.assign(D.inspectOpts, {
        ...DEFAULT_INSPECT_OPTS,
    })
}

const dataUnionDebug = Debug('DataUnion')

const DataUnionDebug = Object.assign(dataUnionDebug.extend.bind(dataUnionDebug), {
    enable: Debug.enable.bind(Debug),
    disable: Debug.disable.bind(Debug),
    humanize: Debug.humanize.bind(Debug) as (v: any) => string,
})

export type Debugger = ReturnType<typeof DataUnionDebug>

export {
    DataUnionDebug as Debug,
}

export function inspect(value: unknown, inspectOptions: Parameters<typeof util.inspect>[1] = {}): string {
    return util.inspect(value, {
        ...DEFAULT_INSPECT_OPTS,
        ...inspectOptions,
    })
}

export function formatWithOptions(inspectOptions: Parameters<typeof util.formatWithOptions>[0], msgFormat?: string, ...param: any[]): string {
    if (typeof util.formatWithOptions !== 'function') {
        // util.formatWithOptions is not browserified, use util.format instead
        return util.format(msgFormat, ...param)
    }

    return util.formatWithOptions({
        ...DEFAULT_INSPECT_OPTS,
        ...inspectOptions,
    }, msgFormat, ...param)
}

export function format(msgFormat?: string, ...param: any[]): string {
    return formatWithOptions(DEFAULT_INSPECT_OPTS, msgFormat, ...param)
}
