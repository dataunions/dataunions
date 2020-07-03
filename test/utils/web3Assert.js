/*global web3 assert */

const BN = require("bn.js")

/**
 * Assert equality in web3 return value sense, modulo conversions to "normal" JS strings and numbers
 */
function assertEqual(actual, expected) {
    // basic assert.equal comparison according to https://nodejs.org/api/assert.html#assert_assert_equal_actual_expected_message
    if (actual == expected) { return }  // eslint-disable-line eqeqeq
    // also handle arrays for convenience
    if (Array.isArray(actual) && Array.isArray(expected)) {
        assert.strictEqual(actual.length, expected.length, "Arrays have different lengths, supplied wrong number of expected values!")
        actual.forEach((a, i) => assertEqual(a, expected[i]))
        return
    }
    // use BigNumber's own comparator
    if (BN.isBN(expected)) {
        //assert.strictEqual(actual.cmp(expected), 0)
        assert.strictEqual(actual.toString(), expected.toString())
        return
    }
    // convert BigNumbers if expecting a number
    // NB: there's a reason BigNumbers are used! Keep your numbers small!
    // if the number coming back from contract is big, then expect a BigNumber to avoid this conversion
    if (typeof expected === "number") {
        assert.strictEqual(+actual, +expected)
        return
    }
    // convert hex bytes to string if expected thing looks like a string and not hex
    if (typeof expected === "string" && Number.isNaN(+expected) && !Number.isNaN(+actual)) {
        assert.strictEqual(web3.toUtf8(actual), expected)
        return
    }
    // fail now with nice error if didn't hit the filters
    assert.equal(actual, expected)
}

function assertEvent(truffleResponse, eventName, eventArgs) {
    const allEventNames = truffleResponse.logs.map(log => log.event).join(", ")
    const log = truffleResponse.logs.find(L => L.event === eventName)
    assert(log, `Event ${eventName} expected, got: ${allEventNames}`)
    Object.keys(eventArgs || {}).forEach(arg => {
        assert(log.args[arg], `Event ${eventName} doesn't have expected property "${arg}", try one of: ${Object.keys(log.args).join(", ")}`)
        assertEqual(log.args[arg], eventArgs[arg])
    })
}

/**
 * Sometimes truffle can't decode the event (maybe contract from outside the test)
 * It can still be tested if the event function signature is known to you
 * NB: This must be VERY exact, no whitespace please, and type names in canonical form
 * @see https://solidity.readthedocs.io/en/develop/abi-spec.html#function-selector
 */
function assertEventBySignature(truffleResponse, sig) {
    const allEventHashes = truffleResponse.receipt.logs.map(log => log.topics[0].slice(0, 8)).join(", ")
    const hash = web3.sha3(sig)
    const log = truffleResponse.receipt.logs.find(L => L.topics[0] === hash)
    assert(log, `Event ${sig} expected, hash: ${hash.slice(0, 8)}, got: ${allEventHashes}`)
}

async function assertFails(promise, reason) {
    let failed = false
    try {
        await promise
    } catch (e) {
        failed = true
        if (reason) {
            assert.strictEqual(e.reason, reason)
        }
    }
    if (!failed) {
        throw new Error("Expected call to fail")
    }
}

module.exports = {
    assertEqual,
    assertEvent,
    assertEventBySignature,
    assertFails,
}
