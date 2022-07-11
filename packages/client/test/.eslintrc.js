module.exports = {
    globals: {
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
        "import/no-extraneous-dependencies": "off"
    },
}