import { verifyMessage } from "@ethersproject/wallet"
import type { Signer } from "@ethersproject/abstract-signer"
import type { EthereumAddress } from "./types"

/** Request object ready to be sent to @dataunions/join-server */
type SignedRequest = {
    /** The address that (claims to have) originated the request */
    address: EthereumAddress,
    /** The requestObject serialized to JSON */
    request: string,
    /** The timestamp of the request (when it was signed if not given) */
    timestamp: string,
    /** Signature by the signer signing [request ++ timestamp] */
    signature: string,
}

export async function sign(requestObject: unknown, signer: Signer, signatureTimestamp = new Date()): Promise<SignedRequest> {
    const address = await signer.getAddress()
    const request = JSON.stringify(requestObject)
    const timestamp = signatureTimestamp.toISOString()
    const signature = await signer.signMessage(request + timestamp)
    return {
        address,
        request,
        timestamp,
        signature,
    }
}

/**
 * Verifies that the signedObject is valid.
 * Resolves with the parsed request payload, or rejects with an error if the request is not valid.
 */
export function verify(signedObject: SignedRequest, toleranceMillis = 5 * 60 * 1000): unknown {
    const {
        address,
        request,
        timestamp,
        signature,
    } = signedObject

    // Check signature
    const recoveredAddress = verifyMessage(request + timestamp, signature)
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
  	    throw new Error(`Invalid signature! recoveredAddress: ${recoveredAddress}, address: ${address}!`)
    }

    // Check timestamp
    const currentTime = new Date()
    const diff = currentTime.getTime() - new Date(timestamp).getTime()
    if (Math.abs(diff) > toleranceMillis) {
        throw new Error("Timestamp rejected! "
            + `Request: ${timestamp}, current: ${currentTime.toISOString()}, diff (ms): ${diff}, tolerance: ${toleranceMillis}`)
    }

    return JSON.parse(signedObject.request)
}
