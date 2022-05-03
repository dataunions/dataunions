import 'reflect-metadata'
import { container as rootContainer } from 'tsyringe'
import { ConfigInjectionToken, createStrictConfig, DataUnionClientConfig, StrictDataUnionClientConfig } from './Config'
import { DataUnionContainer } from './Container'
import DataUnions from './DataUnionAPI'
import { Ethereum } from './Ethereum'
import { LoginEndpoints } from './LoginEndpoints'
import { Session } from './Session'
import { counterId, uuid } from './utils'
import { Context } from './utils/Context'
import { Debug } from './utils/log'
import './utils/PatchTsyringe'
import { Methods, Plugin } from './utils/Plugin'

let uid: string = process.pid != null
    // Use process id in node uid.
    ? `${process.pid}`
    // Fall back to `uuid()` later (see initContainer). Doing it here will break browser projects
    // that utilize server-side rendering (no `window` while build's target is `web`).
    : ''

// these are mixed in via Plugin function above
// use MethodNames to only grab methods
export interface DataUnionClient extends Ethereum,
    Methods<DataUnions>,
    Methods<LoginEndpoints>,
    Methods<Session> {
}

class DataUnionClientBase implements Context {
    static generateEthereumAccount = Ethereum.generateEthereumAccount.bind(Ethereum)

    /** @internal */
    readonly id
    /** @internal */
    readonly debug

    constructor(
        context: Context,
        private ethereum: Ethereum,
        private session: Session,
        private loginEndpoints: LoginEndpoints,
        private dataunions: DataUnions,
    ) { // eslint-disable-line function-paren-newline
        this.id = context.id
        this.debug = context.debug
        Plugin(this, this.loginEndpoints)
        Plugin(this, this.ethereum)
        Plugin(this, this.session)
        Plugin(this, this.dataunions)
    }

    /** @internal */
    enableDebugLogging(prefix = 'Streamr*') { // eslint-disable-line class-methods-use-this
        Debug.enable(prefix)
    }

    /** @internal */
    disableDebugLogging() { // eslint-disable-line class-methods-use-this
        Debug.disable()
    }

    async destroy() { }
}

/**
* @internal
*/
export function initContainer(config: StrictDataUnionClientConfig, parentContainer = rootContainer) {
    const c = parentContainer.createChildContainer()
    uid = uid || `${uuid().slice(-4)}${uuid().slice(0, 4)}`
    const id = counterId(`DataUnionClient:${uid}${config.id ? `:${config.id}` : ''}`)
    const debug = Debug(id)
    // @ts-expect-error not in types
    if (!debug.inspectOpts) {
        // @ts-expect-error not in types
        debug.inspectOpts = {}
    }
    // @ts-expect-error not in types
    Object.assign(debug.inspectOpts, {
        // @ts-expect-error not in types
        ...debug.inspectOpts,
        ...config.debug.inspectOpts
    })
    debug('create')

    const rootContext = {
        id,
        debug
    }

    c.register(Context as any, {
        useValue: rootContext
    })

    c.register(DataUnionContainer, {
        useValue: c
    })

    // associate values to config tokens
    const configTokens: [symbol, object][] = [
        [ConfigInjectionToken.Root, config],
        [ConfigInjectionToken.Auth, config.auth],
        [ConfigInjectionToken.Connection, config],
        [ConfigInjectionToken.Ethereum, config],
    ]

    configTokens.forEach(([token, useValue]) => {
        c.register(token, { useValue })
    })

    return {
        childContainer: c,
        rootContext
    }
}

/**
* @category Important
*/
export class DataUnionClient extends DataUnionClientBase {
    constructor(options: DataUnionClientConfig = {}, parentContainer = rootContainer) {
        const config = createStrictConfig(options)
        const { childContainer: c } = initContainer(config, parentContainer)
        super(
            c.resolve<Context>(Context as any),
            c.resolve<Ethereum>(Ethereum),
            c.resolve<Session>(Session),
            c.resolve<LoginEndpoints>(LoginEndpoints),
            c.resolve<DataUnions>(DataUnions),
        )
    }
}

/** @internal */
export const Dependencies = {
    Context,
    Session,
    LoginEndpoints,
    DataUnions,
}
