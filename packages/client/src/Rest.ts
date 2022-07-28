/**
 * More ergonomic wrapper around fetch/authFetch
 */
import { authFetch } from './authFetch'

export type FetchOptions = {
    query?: any,
    useSession?: boolean,
    options?: any,
    requireNewToken?: boolean
    // debug?: Debugger
    restUrl?: string
}

export type UrlParts = (string | number)[]

function serialize(body: any): string | undefined {
    if (body == null) { return undefined }
    return typeof body === 'string' ? body : JSON.stringify(body)
}

export const createQueryString = (query: Record<string, any>) => {
    const withoutEmpty = Object.fromEntries(Object.entries(query).filter(([_k, v]) => v != null))
    return new URLSearchParams(withoutEmpty).toString()
}

export class Rest {
    // readonly id
    // readonly debug

    restUrl: string
    constructor(
        restUrl: string,
    ) {
        // this.id = instanceId(this)
        // this.debug = context.debug.extend(this.id)
        this.restUrl = restUrl
    }

    getUrl(urlParts: UrlParts, query = {}, restUrl = this.restUrl): URL {
        const url = new URL(urlParts.map((s) => encodeURIComponent(s)).join('/'), restUrl + '/')
        url.search = createQueryString(query)
        return url
    }

    // get session() {
    //     return this.container.resolve<Session>(Session)
    // }

    fetch<T extends object>(
        urlParts: UrlParts,
        {
            query,
            // useSession = true,
            options,
            // requireNewToken = false,
            // debug = this.debug,
            restUrl
        }: FetchOptions
    ): Promise<T> {
        const url = this.getUrl(urlParts, query, restUrl)
        const newOptions = {
            ...options,
            // session: useSession ? this.session : undefined
        }
        return authFetch<T>(
            url.toString(),
            newOptions,
            // requireNewToken,
            // debug,
        )
    }

    post<T extends object>(urlParts: UrlParts, body?: any, options: FetchOptions = {}) {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options?.options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.options?.headers,
                },
                method: 'POST',
                body: serialize(body),
            }
        })
    }

    get<T extends object>(urlParts: UrlParts, options: FetchOptions = {}) {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options.options,
                method: 'GET',
            }
        })
    }

    put<T extends object>(urlParts: UrlParts, body?: any, options: FetchOptions = {}) {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options.options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.options?.headers,
                },
                method: 'PUT',
                body: serialize(body),
            }
        })
    }

    del<T extends object>(urlParts: UrlParts, options: FetchOptions = {}) {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options.options,
                method: 'DELETE',
            }
        })
    }
}
