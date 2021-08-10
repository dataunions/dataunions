module.exports = {
    globals: {
        // truffle
        contract: "readonly",
        web3: "readonly",
        artifacts: "readonly",
        assert: "readonly",

        // mocha
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        beforeEach: "readonly",
        after: "readonly",
        afterEach: "readonly",
    },
    rules: {
        "no-console": "warn",
    },
}