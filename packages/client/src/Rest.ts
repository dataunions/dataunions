/**
 * More ergonomic wrapper around fetch/authFetch
 */
import { authFetch } from './authFetch'

export type FetchOptions = {
    query?: any,
    useSession?: boolean,
    options?: any,
    requireNewToken?: boolean
    restUrl?: string
}

export type UrlParts = (string | number)[]

function serialize(body: any): string | undefined {
    if (body == null) { return undefined }
    return typeof body === 'string' ? body : JSON.stringify(body)
}

export const createQueryString = (query: Record<string, any>): string => {
    const withoutEmpty = Object.fromEntries(Object.entries(query).filter(([_k, v]) => v != null))
    return new URLSearchParams(withoutEmpty).toString()
}

export class Rest {
    restUrl: string
    constructor(
        restUrl: string,
    ) {
        this.restUrl = restUrl
    }

    getUrl(urlParts: UrlParts, query = {}, restUrl = this.restUrl): URL {
        const url = new URL(urlParts.map((s) => encodeURIComponent(s)).join('/'), restUrl + '/')
        url.search = createQueryString(query)
        return url
    }

    fetch<T extends object>(
        urlParts: UrlParts,
        {
            query,
            options,
            restUrl
        }: FetchOptions
    ): Promise<T> {
        const url = this.getUrl(urlParts, query, restUrl)
        const newOptions = {
            ...options,
        }
        return authFetch<T>(
            url.toString(),
            newOptions,
        )
    }

    post<T extends object>(urlParts: UrlParts, body?: null | string | any, options: FetchOptions = {}): Promise<T> {
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

    get<T extends object>(urlParts: UrlParts, options: FetchOptions = {}): Promise<T> {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options.options,
                method: 'GET',
            }
        })
    }

    put<T extends object>(urlParts: UrlParts, body?: null | string | any, options: FetchOptions = {}): Promise<T> {
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

    delete<T extends object>(urlParts: UrlParts, options: FetchOptions = {}): Promise<T> {
        return this.fetch<T>(urlParts, {
            ...options,
            options: {
                ...options.options,
                method: 'DELETE',
            }
        })
    }
}
