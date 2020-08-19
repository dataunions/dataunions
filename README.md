# data-union-solidity

A Data Union (DU) is a collection of "members" that split token revenue sent to a single mainnet contract. This DU implementation uses the following components:

1. A **mainchain** contract where revenue is sent.
2. A **sidechain** contract that records joins and parts of group members, calculates earnings (in constant time), processes withdraw requests.
3. A **bridge** system that connects the mainchain and sidechain. See POA Tokenbridge https://github.com/poanetwork/tokenbridge.

The purpose of the sidechain is to **facilitate cheap join and part operations**. The basic workflow looks like this:

0. Deploy factory contracts if needed. They are pre-baked into supplied docker images. See [Getting Started](#getting-started)
1. create a [DataUnionMainnet](https://github.com/streamr-dev/data-union-solidity/blob/master/contracts/DataUnionMainnet.sol) using [mainnetFactory.deployNewDataUnion()](https://github.com/streamr-dev/data-union-solidity/blob/b703721ad0b4aff0bde297b88293365ea2d37022/contracts/DataUnionFactoryMainnet.sol#L114)
    1. this will automatically create [DataUnionSidechain](https://github.com/streamr-dev/data-union-solidity/blob/master/contracts/DataUnionSidechain.sol) via the bridge. The address of the sidechain contract is [predictable](#note-about-addresses). 
2. `addMembers()` on [DataUnionSidechain](https://github.com/streamr-dev/data-union-solidity/blob/master/contracts/DataUnionSidechain.sol)
3. send tokens to DataUnionMainnet and call `sendTokensToBridge()`
    1. this will "send" the tokens across the bridge the sidechain DataUnionSidechain using the token mediator contracts
4. `withdraw()` members on DataUnionSidechain
    1. this will "send" the tokens across the bridge to mainnet to the members' addresses 


# Overview of Components

## Factories

The DataUnionFactoryMainnet and DataUnionFactorySidechain contract produce DataUnionMainnet and DataUnionSidechain instances using a cloned template.

#### Note About Addresses
The factory contracts make use of [CREATE2](https://eips.ethereum.org/EIPS/eip-1014), which creates a contract address at predictable address given by:
`keccak256( 0xff ++ factory_address ++ salt ++ keccak256(contract_code))`

DataUnionFactoryMainnet creates DataUnionMainnet using 
`salt = keccak256( some_string_name_as_bytes ++ deployer_address)`

then DataUnionMainnet sends a message over the AMB to DataUnionFactorySidechain to create the sidenet contract. In that case:
`salt = mainnet_address`

So you can always fetch the DataUnionSidechain address deterministically by calling DataUnionMainnet.sidechainAddress().


## Mainchain Contract



## The Bridge
The bridge has 3 main components:
1. Arbitrary Message Bridge (AMB): smart contracts on main and side chains that pass arbitrary function calls between the chains.
2. ERC677 token mediator: contracts that talk to the AMB in order to facilitate token transfers across the bridge. Mainnet tokens can be transferred to the mainnet mediator contract and "passed" to sidechain by minting a special ERC20. This sidenet ERC20 can be "passed" back to mainnet by transferring to the sidechain mediator.
3. Oracles: Each oracle node runs a set of processes in Docker. The oracles attest to transactions submitted to the AMB and pass verified transactions across the bridge in both directions. A production setup includes multiple oracles and a majority of oracle votes is needed to verify a transaction. The rules for oracle voting can be setup in tokenbridge.

# Getting Started
The easiest way to get started running and testing Data Unions is to use the preloaded test images baked into https://github.com/streamr-dev/streamr-docker-dev:

0. cd streamr-docker-dev
1. sudo ifconfig lo:0 10.200.10.1/24 [must link 10.200.10.1 to loopback so containers can communicate]
2.  docker-compose up -d bridge parity-node0 parity-sidechain-node0

This will use parity images for mainchain and sidechain that are preloaded with the AMB, token mediators, and DU factory contracts. It will also spin up required oracle processes. In the test environment, there is only 1 oracle.

Alternatively, you can build this setup from scratch. See https://github.com/streamr-dev/smart-contracts-init for smart contract init, and https://github.com/streamr-dev/streamr-docker-dev for oracle init.




the following curl command shows if contract exists:
curl -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["<address>"],"id":1}' $RPC

where RPC in docker =
localhost:8545 mainchain
localhost:8546 sidechain
