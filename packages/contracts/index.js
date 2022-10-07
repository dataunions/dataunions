/* eslint-disable @typescript-eslint/no-var-requires */
const { abi: templateAbi, bytecode: templateBytecode } = require("./artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json")
const { abi: factoryAbi, bytecode: factoryBytecode } = require("./artifacts/contracts/DataUnionFactory.sol/DataUnionFactory.json")
const { abi: oracleAbi, bytecode: oracleBytecode } = require("./artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json")

module.exports = {
    DataUnionTemplate: { abi: templateAbi, bytecode: templateBytecode },
    DataUnionFactory: { abi: factoryAbi, bytecode: factoryBytecode },
    DefaultFeeOracle: { abi: oracleAbi, bytecode: oracleBytecode },
}
