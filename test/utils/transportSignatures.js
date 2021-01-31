const {
    BigNumber,
} = require("ethers")

const log = require("debug")("Streamr:DU:test-utils")
// const log = console.log // useful for debugging sometimes
async function requiredSignaturesHaveBeenCollected(messageHash, amb) {
    const requiredSignatureCount = await amb.requiredSignatures()

    // Bit 255 is set to mark completion, double check though
    const sigCountStruct = await amb.numMessagesSigned(messageHash)
    const collectedSignatureCount = sigCountStruct.mask(255)
    const markedComplete = sigCountStruct.shr(255).gt(0)

    log(`${collectedSignatureCount.toString()} out of ${requiredSignatureCount.toString()} collected`)
    if (markedComplete) { log("All signatures collected") }
    return markedComplete
}

// move signatures from sidechain to mainnet
async function transportSignatures(messageHash, wallet, sidechainAmb, mainnetAmb) {
    const message = await sidechainAmb.message(messageHash)
    const sigCountStruct = await sidechainAmb.numMessagesSigned(messageHash)
    const collectedSignatureCount = sigCountStruct.mask(255).toNumber()

    log(`${collectedSignatureCount} signatures reported, getting them from the sidechain AMB...`)
    const signatures = await Promise.all(Array(collectedSignatureCount).fill(0).map(async (_, i) => sidechainAmb.signature(messageHash, i)))

    const [vArray, rArray, sArray] = [[], [], []]
    signatures.forEach((signature, i) => {
        log(`  Signature ${i}: ${signature} (len=${signature.length}=${signature.length / 2 - 1} bytes)`)
        rArray.push(signature.substr(2, 64))
        sArray.push(signature.substr(66, 64))
        vArray.push(signature.substr(130, 2))
    })
    const packedSignatures = BigNumber.from(signatures.length).toHexString() + vArray.join("") + rArray.join("") + sArray.join("")
    log(`All signatures packed into one: ${packedSignatures}`)
    log(`Sending message from wallet ${wallet.address}`)
    const txAMB = await mainnetAmb.executeSignatures(message, packedSignatures)
    const trAMB = await txAMB.wait()
    return trAMB
}

module.exports = {
    requiredSignaturesHaveBeenCollected,
    transportSignatures,
}
