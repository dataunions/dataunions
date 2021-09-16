#!/bin/bash
set -ex

# start in this /scripts directory
cd "$(dirname "$0")"

cd ../packages/data-union-solidity
npm run build

jq .abi build/hardhat-artifacts/contracts/DataUnionFactorySidechain.sol/DataUnionFactorySidechain.json > ../subgraph/abis/DataUnionFactorySidechain.json
jq .abi build/hardhat-artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json > ../subgraph/abis/DataUnionSidechain.json