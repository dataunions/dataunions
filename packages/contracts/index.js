/* eslint-disable @typescript-eslint/no-var-requires */
const { abi: tAbi, bytecode: tBytecode } = require("./artifacts/contracts/unichain/DataUnionTemplate.sol/DataUnionTemplate.json")
const { abi: fAbi, bytecode: fBytecode } = require("./artifacts/contracts/unichain/DataUnionFactory.sol/DataUnionFactory.json")
const { abi: oAbi, bytecode: oBytecode } = require("./artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json")

module.exports = {
    dataUnionTemplate: { abi: tAbi, bytecode: tBytecode },
    dataUnionFactory: { abi: fAbi, bytecode: fBytecode },
    defaultFeeOracle: { abi: oAbi, bytecode: oBytecode },
}
