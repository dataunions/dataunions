const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const { BN, toWei } = w3.utils
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
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
async function makeSetBinanceRecipientSignature(to, nonce, adapterAddress, signer) {
    const message = to + nonce.toString(16, 64) + adapterAddress.slice(2)
    return w3.eth.sign(message, signer)
}

contract("BinanceAdapter", accounts => {
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)
    let testToken, migrateToken, dataUnionSidechain, migrationManager, adapter, mockBinanceMediator

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
        //amd address 0 is dummy
        mockBinanceMediator = await MockTokenMediator.new(testToken.address, zeroAddress, {from: creator})
        //    constructor(address dataCoin_, address honeyswapRouter_, address bscBridge_, address convertToCoin_, address liquidityToken_) public {
        // no conversion until we install Uniswap contract
        adapter = await BinanceAdapter.new(testToken.address, zeroAddress, mockBinanceMediator.address, zeroAddress, zeroAddress, {from: creator }) 
        log(`DataUnionSidechain initialized at ${dataUnionSidechain.address}`)
        log(`  creator: ${creator}`)
        log(`  agents: ${JSON.stringify(agents)}`)
        log(`  members: ${JSON.stringify(members)}`)
        log(`  outsider addresses used in tests: ${JSON.stringify(others)}`)
    })

    it("can set Binance recipient", async () => {
        await adapter.setBinanceRecipient(members[1], {from: members[0]})
        assertEqual(members[1], (await adapter.binanceRecipient(members[0]))[0])
        // set members[1]'s recipient to member[2] using signature
        let nonce = (await adapter.binanceRecipient(members[1]))[1]
        nonce = nonce.add(new BN(1))
        const sig = await makeSetBinanceRecipientSignature(members[2], nonce, adapter.address, members[1])
        //console.log(`nonce ${nonce} sig ${sig} ${members[1]} ${members[2]}`)
        await adapter.setBinanceRecipientFromSig(members[1], members[2], nonce, sig, {from: members[0]})
        assertEqual(members[2], (await adapter.binanceRecipient(members[1]))[0])

        //replay should fail
        await assertFails(adapter.setBinanceRecipientFromSig(members[1], members[2], nonce, sig, {from: members[0]}))
    }),
    it("can withdraw to mediator without conversion", async () => {
        const amt = toWei("300")
        await testToken.transferAndCall(dataUnionSidechain.address, amt, "0x", {from: creator})
        const bal = toWei("100")
        assertEqual(bal, await dataUnionSidechain.getWithdrawableEarnings(members[0]))
        
        //members[0] withdraws to member[1] via bridge
        await adapter.setBinanceRecipient(members[1], {from: members[0]})
        const bridge = await adapter.bscBridge()
        await dataUnionSidechain.withdrawAllTo(adapter.address, false, {from: members[0]})
        assertEqual(0, await dataUnionSidechain.getWithdrawableEarnings(members[0]))
        assertEqual(await testToken.balanceOf(mockBinanceMediator.address), 0)        
        assertEqual(await testToken.balanceOf(members[0]), 0)
        assertEqual(await testToken.balanceOf(members[1]), bal)
    })

})
