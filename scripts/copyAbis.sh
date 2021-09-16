#!/bin/bash
set -ex

# start in this /scripts directory
cd "$(dirname "$0")"

cd ../packages/data-union-solidity
npm run build
# jq .abi build/contracts/DataUnionFactorySidechain.json > ../subgraph/abis/DataUnionFactorySidechain.json
# jq .abi build/contracts/DataUnionSidechain.json > ../subgraph/abis/DataUnionSidechain.json
jq .abi artifacts/contracts/DataUnionFactorySidechain.sol/DataUnionFactorySidechain.json > ../subgraph/abis/DataUnionFactorySidechain.json
jq .abi artifacts/contracts/DataUnionSidechain.sol/DataUnionSidechain.json > ../subgraph/abis/DataUnionSidechain.json