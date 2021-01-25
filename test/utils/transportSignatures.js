const {
    BigNumber,
    Contract,
    arrayify,
    verifyMessage,
} = require("ethers")

const log = require("debug")("Streamr:DU:test-utils")
// const log = console.log // useful for debugging sometimes

const DataUnionFactoryMainnet = require("../build/contracts/DataUnionFactoryMainnet.json")

const mainnetAmbABI = [{
    name: "executeSignatures",
    inputs: [{ type: "bytes" }, { type: "bytes" }], // data, signatures
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
}, {
    name: "messageCallStatus",
    inputs: [{ type: "bytes32" }], // messageId
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "failedMessageSender",
    inputs: [{ type: "bytes32" }], // messageId
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "relayedMessages",
    inputs: [{ type: "bytes32" }], // messageId, was called "_txhash" though?!
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "validatorContract",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function"
}]

const sidechainAmbABI = [{
    name: "signature",
    inputs: [{ type: "bytes32" }, { type: "uint256" }], // messageHash, index
    outputs: [{ type: "bytes" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "message",
    inputs: [{ type: "bytes32" }], // messageHash
    outputs: [{ type: "bytes" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "requiredSignatures",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
}, {
    name: "numMessagesSigned",
    inputs: [{ type: "bytes32" }], // messageHash (TODO: double check)
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
}]

// Find the Asyncronous Message-passing Bridge sidechain ("home") contract
let cachedSidechainAmb
async function getSidechainAmb(options) {
    const {
        factoryMainnetAddress,
        mainnetProvider,
        sidechainProvider,
    } = options
    if (!cachedSidechainAmb) {
        const getAmbPromise = async () => {
            const factoryMainnet = new Contract(factoryMainnetAddress, DataUnionFactoryMainnet.abi, mainnetProvider)
            const factorySidechainAddress = await factoryMainnet.data_union_sidechain_factory()
            const factorySidechain = new Contract(factorySidechainAddress, [{
                name: "amb",
                inputs: [],
                outputs: [{ type: "address" }],
                stateMutability: "view",
                type: "function"
            }], sidechainProvider)
            const sidechainAmbAddress = await factorySidechain.amb()
            return new Contract(sidechainAmbAddress, sidechainAmbABI, sidechainProvider)
        }
        cachedSidechainAmb = getAmbPromise()
        cachedSidechainAmb = await cachedSidechainAmb // eslint-disable-line require-atomic-updates
    }
    return cachedSidechainAmb
}

async function getMainnetAmb(options) {
    const {
        factoryMainnetAddress,
        mainnetProvider,
    } = options
    const factoryMainnet = new Contract(factoryMainnetAddress, DataUnionFactoryMainnet.abi, mainnetProvider)
    const mainnetAmbAddress = await factoryMainnet.amb()
    return new Contract(mainnetAmbAddress, mainnetAmbABI, mainnetProvider)
}

async function requiredSignaturesHaveBeenCollected(messageHash, options = {}) {
    const sidechainAmb = await getSidechainAmb(options)
    const requiredSignatureCount = await sidechainAmb.requiredSignatures()

    // Bit 255 is set to mark completion, double check though
    const sigCountStruct = await sidechainAmb.numMessagesSigned(messageHash)
    const collectedSignatureCount = sigCountStruct.mask(255)
    const markedComplete = sigCountStruct.shr(255).gt(0)

    log(`${collectedSignatureCount.toString()} out of ${requiredSignatureCount.toString()} collected`)
    if (markedComplete) { log("All signatures collected") }
    return markedComplete
}

// move signatures from sidechain to mainnet
async function transportSignatures(messageHash, wallet, options) {
    const {
        mainnetProvider,
    } = options

    const sidechainAmb = await getSidechainAmb(options)
    const message = await sidechainAmb.message(messageHash)
    const messageId = "0x" + message.substr(2, 64)
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

    // Gas estimation also checks that the transaction would succeed, and provides a helpful error message in case it would fail
    const mainnetAmb = await getMainnetAmb(options)
    log(`Estimating gas using mainnet AMB @ ${mainnetAmb.address}, message=${message}`)
    let gasLimit
    try {
        // magic number suggested by https://github.com/poanetwork/tokenbridge/blob/master/oracle/src/utils/constants.js
        gasLimit = await mainnetAmb.estimateGas.executeSignatures(message, packedSignatures) + 200000
        log(`Calculated gas limit: ${gasLimit.toString()}`)
    } catch (e) {
        // Failure modes from https://github.com/poanetwork/tokenbridge/blob/master/oracle/src/events/processAMBCollectedSignatures/estimateGas.js
        log("Gas estimation failed: Check if the message was already processed")
        const alreadyProcessed = await mainnetAmb.relayedMessages(messageId)
        if (alreadyProcessed) {
            log(`WARNING: Tried to transport signatures but they have already been transported (Message ${messageId} has already been processed)`)
            log("This could happen if payForSignatureTransport=true, but bridge operator also pays for signatures, and got there before your client")
            return null
        }

        log("Gas estimation failed: Check if number of signatures is enough")
        const validatorContractAddress = await mainnetAmb.validatorContract()
        const validatorContract = new Contract(validatorContractAddress, [{
            name: "isValidator",
            inputs: [{ type: "address" }],
            outputs: [{ type: "bool" }],
            stateMutability: "view",
            type: "function"
        }, {
            name: "requiredSignatures",
            inputs: [],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
            type: "function"
        }], mainnetProvider)
        const requiredSignatures = await validatorContract.requiredSignatures()
        if (requiredSignatures.gt(signatures.length)) {
            throw new Error("The number of required signatures does not match between sidechain("
                + signatures.length + " and mainnet( " + requiredSignatures.toString())
        }

        log("Gas estimation failed: Check if all the signatures were made by validators")
        log(`  Recover signer addresses from signatures [${signatures.join(", ")}]`)
        const signers = signatures.map((signature) => verifyMessage(arrayify(message), signature))
        log(`  Check that signers are validators [[${signers.join(", ")}]]`)
        const isValidatorArray = await Promise.all(signers.map((address) => [address, validatorContract.isValidator(address)]))
        const nonValidatorSigners = isValidatorArray.filter(([, isValidator]) => !isValidator)
        if (nonValidatorSigners.length > 0) {
            throw new Error(`Following signers are not listed as validators in mainnet validator contract at ${validatorContractAddress}:\n - `
                + nonValidatorSigners.map(([address]) => address).join("\n - "))
        }

        throw new Error(`Gas estimation failed: Unknown error while processing message ${message} with ${e.stack}`)
    }

    log(`Sending message from wallet ${wallet.address}`)
    const txAMB = await mainnetAmb.connect(wallet).executeSignatures(message, packedSignatures)
    const trAMB = await txAMB.wait()
    return trAMB
}

module.exports = {
    getMainnetAmb,
    requiredSignaturesHaveBeenCollected,
    transportSignatures,
}
