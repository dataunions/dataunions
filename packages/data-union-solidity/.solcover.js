module.exports = {
    // TODO: remove after mainnet factory interface is cleaner
    // right now these must be skipped because they can't be compiled with optimizations off because of the huge amount of arguments in the initialize function
    // CompilerError: Stack too deep when compiling inline assembly: Variable headStart is 1 slot(s) too deep inside the stack.
    skipFiles: [
        "contracts/DataUnionMainnet.sol",
        "contracts/DataUnionFactoryMainnet.sol",
    ]
}