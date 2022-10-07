/* eslint-disable @typescript-eslint/no-var-requires */
const { abi: templateAbi, bytecode: templateBytecode } = require("./artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json")
const { abi: factoryAbi, bytecode: factoryBytecode } = require("./artifacts/contracts/DataUnionFactory.sol/DataUnionFactory.json")
const { abi: oracleAbi, bytecode: oracleBytecode } = require("./artifacts/contracts/DefaultFeeOracle.sol/DefaultFeeOracle.json")

module.exports = {
    dataUnionTemplate: { abi: templateAbi, bytecode: templateBytecode },
    dataUnionFactory: { abi: factoryAbi, bytecode: factoryBytecode },
    defaultFeeOracle: { abi: oracleAbi, bytecode: oracleBytecode },
}
