const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const { BN, toWei } = w3.utils
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const BinanceAdapter = artifacts.require("./BinanceAdapter.sol")
const TestToken = artifacts.require("./TestToken.sol")
const SidechainMigrationManager = artifacts.require("./SidechainMigrationManager.sol")
const log = require("debug")("Streamr:du:test:DataUnionSidechain")
const zeroAddress = "0x0000000000000000000000000000000000000000"
//const log = console.log  // for debugging?

/**
 * In Solidity, the message is created by abi.encodePacked(), which represents addresses unpadded as 20bytes.
 * web3.eth.encodeParameters() encodes addresses padded as 32bytes, so it can't be used
 * encodePacked() method from library would be preferable, but this works
 *
 */
async function getSetBinanceRecipientSignature(to, deadline, adapterAddress, signer) {
    const message = to + deadline.toString(16, 64) + adapterAddress.slice(2)
    return w3.eth.sign(message, signer)
}

contract("DataUnionSidechain", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)
    let testToken, migrateToken, dataUnionSidechain, migrationManager, adapter

    beforeEach(async () => {
        /*
        function initialize(
            address initialOwner,
            address _migrationManager,
            address[] memory initialJoinPartAgents,
            address mainnetDataUnionAddress,
            uint256 defaultNewMemberEth
        ) 
        */
        testToken = await TestToken.new("name", "symbol", { from: creator })
        //mediator is a dummy non-zero address. mediator not used
        migrationManager = await SidechainMigrationManager.new(testToken.address, zeroAddress, agents[0], { from: creator })
        migrateToken = await TestToken.new("migrate", "m", { from: creator })
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        await dataUnionSidechain.initialize(creator, migrationManager.address, agents, agents[0], "1", {from: creator})
        await testToken.mint(creator, toWei("10000"), { from: creator })
        await migrateToken.mint(creator, toWei("10000"), { from: creator })
        await dataUnionSidechain.addMembers(members, {from: agents[1]})

        log(`DataUnionSidechain initialized at ${dataUnionSidechain.address}`)
        log(`  creator: ${creator}`)
        log(`  agents: ${JSON.stringify(agents)}`)
        log(`  members: ${JSON.stringify(members)}`)
        log(`  outsider addresses used in tests: ${JSON.stringify(others)}`)
    })

    it("", async () => {
    })
})
