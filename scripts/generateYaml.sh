#!/bin/bash
set -ex

# start in this /scripts directory
cd "$(dirname "$0")"

cd ../packages/smartcontracts

export STREAM_REGISTRY_ADDRESS=$(jq .address deployments/localsidechain/StreamRegistry.json)
export NODE_REGISTRY_ADDRESS=$(jq .address deployments/localsidechain/NodeRegistry.json)
export STREAM_STORAGE_REGISTRY_ADDRESS=$(jq .address deployments/localsidechain/StreamStorageRegistry.json)

cd ../streamregistry-thegraph-subgraph

cat subgraph.template.yaml |envsubst > subgraph.yaml
