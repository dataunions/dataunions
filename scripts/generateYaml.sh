#!/bin/bash
set -ex

# start in this /scripts directory
cd "$(dirname "$0")"

cd ../packages/data-union-solidity

# default to sync from genesis (useful for test nets but not mainnet!)
export INDEXING_STARTING_BLOCK="${INDEXING_STARTING_BLOCK:-0}"
export DATA_UNION_FACTORY_SIDECHAIN_ADDRESS=$(jq .address build/deployments/mock_xdai/DataUnionFactorySidechain.json)

cd ../subgraph

cat subgraph.template.yaml |envsubst > subgraph.yaml
