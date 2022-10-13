#!/bin/bash
set -ex

# go to package directory
case "$PWD" in
    *data-unions/packages/contracts/scripts) cd ..;;
    *data-unions/packages/contracts) ;;
    *data-unions/packages) cd contracts;;
    *data-unions) cd packages/contracts;;
    *) exit 1;; # default case
esac

# This should be done right after a deployment: update thegraph definitions, use the most current ABIs

jq .abi artifacts/contracts/DataUnionFactory.sol/DataUnionFactory.json > ../thegraph-subgraph/abis/DataUnionFactory.json
jq .abi artifacts/contracts/DataUnionTemplate.sol/DataUnionTemplate.json > ../thegraph-subgraph/abis/DataUnionTemplate.json
