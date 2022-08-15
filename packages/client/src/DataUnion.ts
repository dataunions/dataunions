import type { ContractReceipt, ContractTransaction } from '@ethersproject/contracts'
import type { Signer } from '@ethersproject/abstract-signer'
import { defaultAbiCoder } from '@ethersproject/abi'
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { arrayify, hexZeroPad } from '@ethersproject/bytes'

import type { DataUnionTemplate as DataUnionContract } from '@dataunions/contracts/typechain'

import { Debug } from './utils/log'
import { sleep } from './utils'
import { sign } from './signing'
import type { EthereumAddress } from './types'
import type { DataUnionClient } from './DataUnionClient'
import type { Rest } from './Rest'

export interface DataUnionDeployOptions {
    owner?: EthereumAddress,
    joinPartAgents?: EthereumAddress[],
    dataUnionName?: string,
    adminFee?: number,
    dataUnionFee?: number,
    dataUnionBeneficiary?: EthereumAddress,
    sidechainPollingIntervalMs?: number,
    sidechainRetryTimeoutMs?: number
    confirmations?: number
    gasPrice?: BigNumber
}

export interface JoinResponse {
    member: string
    dataUnion: EthereumAddress
    chain: string
}

export interface DataUnionStats {
    // new stats added in 2.2 (admin & data union fees)
    totalRevenue?: BigNumber,
    totalAdminFees?: BigNumber,
    totalDataUnionFees?: BigNumber,

    // stats that already existed in 2.0
    activeMemberCount: BigNumber,
    inactiveMemberCount: BigNumber,
    joinPartAgentCount: BigNumber,
    totalEarnings: BigNumber,
    totalWithdrawable: BigNumber,
    lifetimeMemberEarnings: BigNumber,
}

export enum MemberStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    NONE = 'NONE',
}

export interface MemberStats {
    status: MemberStatus
    earningsBeforeLastJoin: BigNumber
    totalEarnings: BigNumber
    withdrawableEarnings: BigNumber
}

export interface SecretsResponse {
    secret: string
    dataUnion: EthereumAddress
    chain: string
    name: string
}

const log = Debug('DataUnion')

type WaitForTXOptions = {
    retries: number
    retryInterval: number
}

// TODO: is this really needed? Could retry logic be already in the ethers library?
async function waitOrRetryTx(
    tx: ContractTransaction,
    { retries = 60, retryInterval = 60000 }: Partial<WaitForTXOptions> = {}
): Promise<ContractReceipt> {
    return tx.wait().catch(async (err: any) => {
        log('Attempted transaction: %O', tx)
        log('Got error: %O', err)
        if (err?.body) {
            const body = JSON.parse(err.body)
            const msg = body.error.message
            log('Error message: %s', msg)
            if (retries > 0 && msg.includes('ancient block sync')) {
                log('Sleeping for %dms then retrying %d more time(s).', retryInterval, retries)
                // eslint-disable-next-line promise/no-nesting
                return sleep(retryInterval).then(() => waitOrRetryTx(tx, { retries: retries - 1, retryInterval }))
            }
        }
        throw err
    })
}

/**
 * @category Important
 */
export class DataUnion {

    // TODO: remove DataUnionClient from here. This coupling makes all of this code a ball of mud, completely inter-connected
    private client: DataUnionClient
    private joinServer: Rest
    public readonly contract: DataUnionContract

    /** @internal */
    constructor(contract: DataUnionContract, joinServerConnection: Rest, client: DataUnionClient) {
        // validate and convert to checksum case
        this.client = client
        this.joinServer = joinServerConnection
        this.contract = contract
    }

    getAddress(): EthereumAddress {
        return this.contract.address
    }

    getChainName(): string {
        return this.client.chainName
    }

    async getOwner(): Promise<EthereumAddress> {
        return this.contract.owner()
    }

    /**
     * Get data union admin fee fraction (between 0.0 and 1.0) that admin gets from each revenue event
     * Version 2.2: admin fee is collected in DataUnionSidechain
     * Version 2.0: admin fee was collected in DataUnionMainnet
     */
    async getAdminFee(): Promise<number> {
        const adminFeeBN = await this.contract.adminFeeFraction()
        return +adminFeeBN.toString() / 1e18
    }

    async getAdminAddress(): Promise<EthereumAddress> {
        return this.contract.owner()
    }

    async getActiveMemberCount(): Promise<number> {
        return this.contract.getActiveMemberCount()
    }

    /** Sign and send HTTP POST request to join-server, TODO: put signing and error handling into the Rest class maybe? */
    private async post<T extends object>(endpointPath: string[], params?: object): Promise<T> {
        const request = {
            chain: this.getChainName(),
            dataUnion: this.getAddress(),
            ...params
        }
        const signedRequest = await sign(request, this.client.wallet)
        return this.joinServer.post<T>(endpointPath, signedRequest).catch((err) => {
            if (err.message?.match(/cannot estimate gas/)) {
                throw new Error("Data Union join-server couldn't send the join transaction. Please contact the join-server administrator.")
            }
            throw err
        })
    }

    /**
     * TODO: drop old DU support already probably...
     * Get stats for the DataUnion (version 2).
     * Most of the interface has remained stable, but getStats has been implemented in functions that return
     *   a different number of stats, hence the need for the more complex and very manually decoded query.
     */
    async getStats(): Promise<DataUnionStats> {
        const provider = this.client.wallet.provider!
        const getStatsResponse = await provider.call({
            to: this.getAddress(),
            data: '0xc59d4847', // getStats()
        })
        log('getStats raw response (length = %d) %s', getStatsResponse.length, getStatsResponse)

        // Attempt to decode longer response first; if that fails, try the shorter one. Decoding too little won't throw, but decoding too much will
        // for uint[9] returning getStats, see e.g. https://blockscout.com/xdai/mainnet/address/0x15287E573007d5FbD65D87ed46c62Cf4C71Dd66d/contracts
        // for uint[6] returning getStats, see e.g. https://blockscout.com/xdai/mainnet/address/0x71586e2eb532612F0ae61b624cb0a9c26e2F4c3B/contracts
        try {
            const [[
                totalRevenue, totalEarnings, totalAdminFees, totalDataUnionFees, totalWithdrawn,
                activeMemberCount, inactiveMemberCount, lifetimeMemberEarnings, joinPartAgentCount
            ]] = defaultAbiCoder.decode(['uint256[9]'], getStatsResponse) as BigNumber[][]
            return {
                totalRevenue, // == earnings (that go to members) + adminFees + dataUnionFees
                totalAdminFees,
                totalDataUnionFees,
                totalEarnings,
                totalWithdrawable: totalEarnings.sub(totalWithdrawn),
                activeMemberCount,
                inactiveMemberCount,
                joinPartAgentCount,
                lifetimeMemberEarnings,
            }
        } catch (e) {
            const [[
                totalEarnings, totalEarningsWithdrawn, activeMemberCount, inactiveMemberCount,
                lifetimeMemberEarnings, joinPartAgentCount
            ]] = defaultAbiCoder.decode(['uint256[6]'], getStatsResponse) as BigNumber[][]
            return {
                totalEarnings,
                totalWithdrawable: totalEarnings.sub(totalEarningsWithdrawn),
                activeMemberCount,
                inactiveMemberCount,
                joinPartAgentCount,
                lifetimeMemberEarnings,
            }
        } // TODO: maybe catch and re-throw with a better error message
    }

    /**
     * Get stats of a single data union member
     */
    async getMemberStats(memberAddress: EthereumAddress): Promise<MemberStats> {
        const address = getAddress(memberAddress)
        // TODO: use duSidechain.getMemberStats(address) once it's implemented, to ensure atomic read
        //        (so that memberData is from same block as getEarnings, otherwise withdrawable will be foobar)
        const [
            [statusCode, earningsBeforeLastJoin, , withdrawnEarnings],
            totalEarnings
        ] = await Promise.all([
            this.contract.memberData(address),
            this.contract.getEarnings(address).catch(() => BigNumber.from(0)),
        ])
        const withdrawable = totalEarnings.gt(withdrawnEarnings) ? totalEarnings.sub(withdrawnEarnings) : BigNumber.from(0)
        const statusStrings = [MemberStatus.NONE, MemberStatus.ACTIVE, MemberStatus.INACTIVE]
        return {
            status: statusStrings[statusCode],
            earningsBeforeLastJoin,
            totalEarnings,
            withdrawableEarnings: withdrawable,
        }
    }

    /**
     * Get the amount of tokens the member would get from a successful withdraw
     */
    async getWithdrawableEarnings(memberAddress: EthereumAddress): Promise<BigNumber> {
        return this.contract.getWithdrawableEarnings(getAddress(memberAddress)).catch((error) => {
            if (error.message.includes('error_notMember')) {
                throw new Error(`${memberAddress} is not a member of this DataUnion`)
            }
            throw error
        })
    }

    ///////////////////////////////
    // Member functions
    ///////////////////////////////

    /**
     * Send HTTP(s) request to the join server, asking to join the data union
     */
    async join(params?: object): Promise<JoinResponse> {
        return this.post<JoinResponse>(["join"], params)
    }

    /**
     * Voluntarily leave the DataUnion
     * @returns side-chain transaction receipt
     */
    async part(): Promise<ContractReceipt> {
        const memberAddress = await this.client.getAddress()
        return this.removeMembers([memberAddress])
    }

    async isMember(memberAddress?: EthereumAddress): Promise<boolean> {
        const address = memberAddress ? getAddress(memberAddress) : await this.client.getAddress()
        const memberData = await this.contract.memberData(address)
        const [ state ] = memberData
        const ACTIVE = 1 // memberData[0] is enum ActiveStatus {None, Active, Inactive}
        return (state === ACTIVE)
    }

    async checkMinimumWithdraw(memberAddress: EthereumAddress): Promise<void> {
        const withdrawable = await this.contract.getWithdrawableEarnings(memberAddress)
        if (withdrawable.eq(0)) {
            throw new Error(`${memberAddress} has nothing to withdraw in (sidechain) data union ${this.contract.address}`)
        }

        if (this.client.minimumWithdrawTokenWei && withdrawable.lt(this.client.minimumWithdrawTokenWei)) {
            throw new Error(`${memberAddress} has only ${withdrawable} to withdraw in `
                + `DataUnion ${this.contract.address} (min: ${this.client.minimumWithdrawTokenWei})`)
        }
    }

    /**
     * Withdraw all your earnings
     * @returns the sidechain withdraw transaction receipt
     */
    async withdrawAll(): Promise<ContractReceipt> {
        const memberAddress = await this.client.getAddress()
        await this.checkMinimumWithdraw(memberAddress)

        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.withdrawAll(memberAddress, false, ethersOverrides)
        return tx.wait()
    }

    /**
     * Withdraw earnings and "donate" them to the given address
     * @returns the sidechain withdraw transaction receipt
     */
    async withdrawAllTo(recipientAddress: EthereumAddress): Promise<ContractReceipt> {
        const memberAddress = await this.client.getAddress()
        await this.checkMinimumWithdraw(memberAddress)

        const address = getAddress(recipientAddress)
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.withdrawAllTo(address, false, ethersOverrides)
        return tx.wait()
    }

    /**
     * Member can sign off to "donate" all earnings to another address such that someone else
     *   can submit the transaction (and pay for the gas)
     * This signature is only valid until next withdrawal takes place (using this signature or otherwise).
     * Note that while it's a "blank cheque" for withdrawing all earnings at the moment it's used, it's
     *   invalidated by the first withdraw after signing it. In other words, any signature can be invalidated
     *   by making a "normal" withdraw e.g. `await streamrClient.withdrawAll()`
     * Admin can execute the withdraw using this signature: ```
     *   await adminDataUnionClient.withdrawAllToSigned(memberAddress, recipientAddress, signature)
     * ```
     * @param recipientAddress - the address authorized to receive the tokens
     * @returns signature authorizing withdrawing all earnings to given recipientAddress
     */
    async signWithdrawAllTo(recipientAddress: EthereumAddress): Promise<string> {
        return this.signWithdrawAmountTo(recipientAddress, BigNumber.from(0))
    }

    /**
     * Member can sign off to "donate" specific amount of earnings to another address such that someone else
     *   can submit the transaction (and pay for the gas)
     * This signature is only valid until next withdrawal takes place (using this signature or otherwise).
     * @param recipientAddress - the address authorized to receive the tokens
     * @param amountTokenWei - that the signature is for (can't be used for less or for more)
     * @returns signature authorizing withdrawing all earnings to given recipientAddress
     */
    async signWithdrawAmountTo(
        recipientAddress: EthereumAddress,
        amountTokenWei: BigNumber | number | string
    ): Promise<string> {
        const to = getAddress(recipientAddress) // throws if bad address
        const signer = this.client.wallet
        const address = await signer.getAddress()
        const [activeStatus, , , withdrawn] = await this.contract.memberData(address)
        if (activeStatus == 0) { throw new Error(`${address} is not a member in DataUnion (sidechain address ${this.contract.address})`) }
        return this._createWithdrawSignature(amountTokenWei, to, withdrawn, signer)
    }

    /** @internal */
    async _createWithdrawSignature(
        amountTokenWei: BigNumber | number | string,
        to: EthereumAddress,
        withdrawn: BigNumber,
        signer: Signer
    ): Promise<string> {
        const message = to
            + hexZeroPad(BigNumber.from(amountTokenWei).toHexString(), 32).slice(2)
            + this.getAddress().slice(2)
            + hexZeroPad(withdrawn.toHexString(), 32).slice(2)
        const signature = await signer.signMessage(arrayify(message))
        return signature
    }

    /**
     * Transfer an amount of earnings to another member in DataunionSidechain
     * @param memberAddress - the other member who gets their tokens out of the DataUnion
     * @param amountTokenWei - the amount that want to add to the member
     * @returns receipt once transfer transaction is confirmed
     */
    async transferWithinContract(
        memberAddress: EthereumAddress,
        amountTokenWei: BigNumber | number | string
    ): Promise<ContractReceipt> {
        const address = getAddress(memberAddress) // throws if bad address
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.transferWithinContract(address, amountTokenWei, ethersOverrides)
        return waitOrRetryTx(tx)
    }

    ///////////////////////////////
    // Admin functions
    ///////////////////////////////

    /**
     * Add a new data union secret
     * For data unions that use the default-join-server, members can join without specific approval using this secret
     */
    async createSecret(name: string = 'Untitled Data Union Secret'): Promise<SecretsResponse> {
        return this.post<SecretsResponse>(['secrets', 'create'], { name })
    }

    async deleteSecret(secretId: string): Promise<SecretsResponse> {
        return this.post<SecretsResponse>(['secrets', 'delete'], { secretId })
    }

    async listSecrets(): Promise<SecretsResponse[]> {
        return this.post<SecretsResponse[]>(['secrets', 'list'])
    }

    /**
     * Add given Ethereum addresses as data union members
     */
    async addMembers(memberAddressList: EthereumAddress[]): Promise<ContractReceipt> {
        const members = memberAddressList.map(getAddress) // throws if there are bad addresses
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.addMembers(members, ethersOverrides)
        // TODO ETH-93: wrap promise for better error reporting in case tx fails (parse reason, throw proper error)
        return waitOrRetryTx(tx)
    }

    /**
     * Remove given members from data union
     */
    async removeMembers(memberAddressList: EthereumAddress[]): Promise<ContractReceipt> {
        const members = memberAddressList.map(getAddress) // throws if there are bad addresses
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.partMembers(members, ethersOverrides)
        // TODO ETH-93: wrap promise for better error reporting in case tx fails (parse reason, throw proper error)
        return waitOrRetryTx(tx)
    }

    /**
     * Admin: withdraw earnings (pay gas) on behalf of a member
     * @param memberAddress - the other member who gets their tokens out of the DataUnion
     */
    async withdrawAllToMember(
        memberAddress: EthereumAddress,
    ): Promise<ContractReceipt> {
        const address = getAddress(memberAddress) // throws if bad address
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.withdrawAll(address, false, ethersOverrides)
        return waitOrRetryTx(tx)
    }

    /**
     * Admin: Withdraw a member's earnings to another address, signed by the member
     * @param memberAddress - the member whose earnings are sent out
     * @param recipientAddress - the address to receive the tokens in mainnet
     * @param signature - from member, produced using signWithdrawAllTo
     */
    async withdrawAllToSigned(
        memberAddress: EthereumAddress,
        recipientAddress: EthereumAddress,
        signature: string,
    ): Promise<ContractReceipt> {
        const from = getAddress(memberAddress) // throws if bad address
        const to = getAddress(recipientAddress)
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.withdrawAllToSigned(from, to, false, signature, ethersOverrides)
        return waitOrRetryTx(tx)
    }

    /**
     * Admin: Withdraw a specific amount member's earnings to another address, signed by the member
     * @param memberAddress - the member whose earnings are sent out
     * @param recipientAddress - the address to receive the tokens in mainnet
     * @param signature - from member, produced using signWithdrawAllTo
     */
    async withdrawAmountToSigned(
        memberAddress: EthereumAddress,
        recipientAddress: EthereumAddress,
        amountTokenWei: BigNumber | number | string,
        signature: string,
    ): Promise<ContractReceipt> {
        const from = getAddress(memberAddress) // throws if bad address
        const to = getAddress(recipientAddress)
        const amount = BigNumber.from(amountTokenWei)
        const ethersOverrides = this.client.getOverrides()
        const tx = await this.contract.withdrawToSigned(from, to, amount, false, signature, ethersOverrides)
        return waitOrRetryTx(tx)
    }

    /**
     * Admin: set admin fee (between 0.0 and 1.0) for the data union
     */
    async setAdminFee(newFeeFraction: number): Promise<ContractReceipt> {
        if (newFeeFraction < 0 || newFeeFraction > 1) {
            throw new Error('newFeeFraction argument must be a number between 0...1, got: ' + newFeeFraction)
        }

        const adminFeeBN = BigNumber.from((newFeeFraction * 1e18).toFixed()) // last 2...3 decimals are going to be gibberish
        const duFeeBN = await this.contract.dataUnionFeeFraction()
        const ethersOverrides = this.client.getOverrides()
        let tx
        try {
            tx = await this.contract.setFees(adminFeeBN, duFeeBN, ethersOverrides)
        } catch(error) {
            if (error.message.includes('error_onlyOwner')) {
                const myAddress = await this.contract.signer.getAddress()
                throw new Error(`Setting admin fee for data union ${this.contract.address} failed: ${myAddress} is not the DataUnion admin!`)
            }
            throw error
        }
        return waitOrRetryTx(tx)
    }

    /**
     * Admin: set Data Union DAO fee (between 0.0 and 1.0) for the data union
     */
    async setDataUnionFee(newFeeFraction: number): Promise<ContractReceipt> {
        if (newFeeFraction < 0 || newFeeFraction > 1) {
            throw new Error('newFeeFraction argument must be a number between 0...1, got: ' + newFeeFraction)
        }

        const duFeeBN = BigNumber.from((newFeeFraction * 1e18).toFixed()) // last 2...3 decimals are going to be gibberish
        const adminFeeBN = await this.contract.adminFeeFraction()
        const ethersOverrides = this.client.getOverrides()
        let tx
        try {
            tx = await this.contract.setFees(adminFeeBN, duFeeBN, ethersOverrides)
        } catch(error) {
            if (error.message.includes('error_onlyOwner')) {
                const myAddress = await this.contract.signer.getAddress()
                throw new Error(`Setting admin fee for data union ${this.contract.address} failed: ${myAddress} is not the DataUnion admin!`)
            }
            throw error
        }
        return waitOrRetryTx(tx)
    }

    /**
     * Transfer amount to specific member in DataunionSidechain
     * @param memberAddress - target member who gets the tokens added to their earnings in the the DataUnion
     * @param amountTokenWei - the amount that want to add to the member
     * @returns receipt once transfer transaction is confirmed
     */
    async transferToMemberInContract(
        memberAddress: EthereumAddress,
        amountTokenWei: BigNumber | number | string
    ): Promise<ContractReceipt> {
        const address = getAddress(memberAddress) // throws if bad address
        const amount = BigNumber.from(amountTokenWei)
        const myAddress = await this.client.getAddress()
        const ethersOverrides = this.client.getOverrides()

        // TODO: implement as ERC677 transfer with data=memberAddress, after this feature is deployed
        // const tx = await this.client.token.transferAndCall(this.contract.address, amount, memberAddress, ethersOverrides)
        // TODO: all things below can then be removed until the "return" line, also delete the 2-step test

        // check first that we have enough allowance to do the transferFrom within the transferToMemberInContract
        const allowance = await this.client.getToken().allowance(myAddress, this.contract.address)
        if (allowance.lt(amount)) {
            // TODO: some tokens could fail here; might need resetting allowance to 0 first.
            //   That's why @openzeppelin/contracts:ERC20.sol has "increaseAllowance" but since it's not part of IERC20, prefer not use it here
            const approveTx = await this.client.getToken().approve(this.contract.address, amount, ethersOverrides)
            const approveTr = await waitOrRetryTx(approveTx)
            log('Approval transaction receipt: %o', approveTr)
        }

        const tx = await this.contract.transferToMemberInContract(address, amount, ethersOverrides)
        return waitOrRetryTx(tx)
    }
}
