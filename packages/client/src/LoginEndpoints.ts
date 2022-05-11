/**
 * Login Endpoints Wrapper.
 */

import { delay, inject, Lifecycle, scoped } from 'tsyringe'
import { Ethereum } from './Ethereum'
import { Rest } from './Rest'
import type { EthereumAddress } from './types'
import { instanceId } from './utils'
import { Context } from './utils/Context'

export interface TokenObject {
    token: string
}

export interface UserDetails {
    name: string
    username: string
    imageUrlSmall?: string
    imageUrlLarge?: string
    lastLogin?: string
}

@scoped(Lifecycle.ContainerScoped)
class LoginEndpoints implements Context {
    /** @internal */
    readonly id
    /** @internal */
    readonly debug

    /** @internal */
    constructor(
        @inject(Context as any) context: Context,
        @inject(Ethereum) private ethereum: Ethereum,
        @inject(delay(() => Rest)) private rest: Rest
    ) {
        this.id = instanceId(this)
        this.debug = context.debug.extend(this.id)
    }

    /** @internal */
    async getChallenge(address: EthereumAddress) {
        this.debug('getChallenge %o', {
            address,
        })
        return this.rest.post<{ challenge: string }>(['login', 'challenge', address], undefined, { useSession: false })
    }

    /** @internal */
    async sendChallengeResponse(challenge: { challenge: string }, signature: string, address: EthereumAddress) {
        const props = {
            challenge,
            signature,
            address,
        }
        this.debug('sendChallengeResponse %o', props)
        return this.rest.post<TokenObject>(['login', 'response'], props, { useSession: false })
    }

    /** @internal */
    async loginWithChallengeResponse() {
        const address = await this.ethereum.getAddress()
        this.debug('loginWithChallengeResponse')
        const challenge = await this.getChallenge(address)
        const signature = await this.ethereum.getSigner().signMessage(challenge.challenge)
        return this.sendChallengeResponse(challenge, signature, address)
    }

    async getUserInfo() {
        this.debug('getUserInfo')
        return this.rest.get<UserDetails>(['users', 'me'])
    }

    /** @internal */
    async logoutEndpoint(): Promise<void> {
        this.debug('logoutEndpoint')
        await this.rest.post(['logout'])
    }
}

export { LoginEndpoints }