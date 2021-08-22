const Web3 = require("web3")
const w3 = new Web3(web3.currentProvider)
const { BN, toWei } = w3.utils
const { assertEqual, assertFails } = require("../utils/web3Assert")
const DataUnionSidechain = artifacts.require("./DataUnionSidechain.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const BinanceAdapter = artifacts.require("./BinanceAdapter.sol")
const TestToken = artifacts.require("./TestToken.sol")

// Uniswap v2, originally from @uniswap/v2-periphery/build
const UniswapV2FactoryJson = require("./UniswapV2Factory.json")
// const UniswapV2PairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json")
const UniswapV2Router02Json = require("./UniswapV2Router02.json")
const WETH9Json = require("./WETH9.json")

const UniswapV2Factory = new w3.eth.Contract(UniswapV2FactoryJson.abi, null, { data: UniswapV2FactoryJson.bytecode })
//const UniswapV2Pair = new w3.eth.Contract(UniswapV2PairJson.abi, null, { data: UniswapV2PairJson.bytecode })
const UniswapV2Router02 = new w3.eth.Contract(UniswapV2Router02Json.abi, null, { data: UniswapV2Router02Json.bytecode })
const WETH9 = new w3.eth.Contract(WETH9Json.abi, null, { data: WETH9Json.bytecode })

const log = require("debug")("Streamr:du:test:DataUnionSidechain")
const futureTime = 4449513600

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

async function deployUniswap2(creator) {
/*
    let deployer = new ContractFactory(WETH9.abi, WETH9.bytecode, wallet)
    let tx = await deployer.deploy()
    const weth = await tx.deployed()
    log(`WETH deployed to ${weth.address}`)
*/
    const weth = await WETH9.deploy(({ arguments: [] })).send({ gas: 6000000, from: creator })
    const factory = await UniswapV2Factory.deploy(({ arguments: [creator] })).send({ gas: 6000000, from: creator })
    const router = await UniswapV2Router02.deploy(({ arguments: [factory.options.address, weth.options.address] })).send({ gas: 6000000, from: creator })
    log(`created Uniswap2. Router: ${router.options.address}`)
    return router
}

contract("BinanceAdapter", accounts => {
    const dummyAddress = "0x0000000000000000000000000000000000001234"
    const creator = accounts[0]
    const agents = accounts.slice(1, 3)
    const members = accounts.slice(3, 6)
    const others = accounts.slice(6)
    let testToken, otherToken, dataUnionSidechain, mockBinanceMediator, uniswapRouter

    before(async () => {
        uniswapRouter = await deployUniswap2(creator)
        testToken = await TestToken.new("name", "symbol", { from: creator })
        otherToken = await TestToken.new("migrate", "m", { from: creator })

        await testToken.mint(creator, toWei("10000"), { from: creator })
        await otherToken.mint(creator, toWei("10000"), { from: creator })

        //amd address 0 is dummy
        mockBinanceMediator = await MockTokenMediator.new(testToken.address, dummyAddress, {from: creator})
        //    constructor(address dataCoin_, address honeyswapRouter_, address bscBridge_, address convertToCoin_, address liquidityToken_) public {
        // no conversion until we install Uniswap contract

        //10 testToken ~= 1 otherToken
        const amtTest = toWei("1000")
        const amtOther = toWei("100")
        await testToken.approve(uniswapRouter.options.address, amtTest, { from: creator })
        await otherToken.approve(uniswapRouter.options.address, amtOther, { from: creator })
        await uniswapRouter.methods.addLiquidity(testToken.address, otherToken.address, amtTest, amtOther, 0, 0, creator, futureTime).send({gas: 6000000, from: creator})
    })

    beforeEach(async () => {
        //mediator is a dummy non-zero address. mediator not used
        dataUnionSidechain = await DataUnionSidechain.new({from: creator})
        // function initialize(
        //     address initialOwner,
        //     address tokenAddress,
        //     address tokenMediatorAddress,
        //     address[] memory initialJoinPartAgents,
        //     address mainnetDataUnionAddress,
        //     uint256 defaultNewMemberEth,
        //     uint256 initialAdminFeeFraction,
        //     uint256 initialDataUnionFeeFraction,
        //     address initialDataUnionBeneficiary
        // )
        await dataUnionSidechain.initialize(
            creator,
            testToken.address,
            dummyAddress,
            agents,
            dummyAddress,
            "1",
            "0",
            "0",
            dummyAddress,
            {from: creator}
        )

        await dataUnionSidechain.addMembers(members, {from: agents[1]})
        log(`DataUnionSidechain initialized at ${dataUnionSidechain.address}`)
        log(`  creator: ${creator}`)
        log(`  agents: ${JSON.stringify(agents)}`)
        log(`  members: ${JSON.stringify(members)}`)
        log(`  outsider addresses used in tests: ${JSON.stringify(others)}`)
    })

    it("can set Binance recipient", async () => {
        let adapter = await BinanceAdapter.new(testToken.address, dummyAddress, mockBinanceMediator.address, dummyAddress, dummyAddress, {from: creator })
        await adapter.setBinanceRecipient(members[1], {from: members[0]})
        assertEqual(members[1], (await adapter.binanceRecipient(members[0]))[0])
        // set members[1]'s recipient to member[2] using signature
        let nonce = (await adapter.binanceRecipient(members[1]))[1]
        nonce = nonce.add(new BN(1))
        const sig = await makeSetBinanceRecipientSignature(members[2], nonce, adapter.address, members[1])
        //console.log(`nonce ${nonce} sig ${sig} ${members[1]} ${members[2]}`)
        await adapter.setBinanceRecipientFromSig(members[1], members[2], sig, {from: members[0]})
        assertEqual(members[2], (await adapter.binanceRecipient(members[1]))[0])

        //replay should fail
        await assertFails(adapter.setBinanceRecipientFromSig(members[1], members[2], sig, {from: members[0]}))
    })

    it.skip("can withdraw to mediator without conversion", async () => {
        let adapter = await BinanceAdapter.new(testToken.address, dummyAddress, mockBinanceMediator.address, dummyAddress, dummyAddress, {from: creator })
        const amt = toWei("300")
        await testToken.transferAndCall(dataUnionSidechain.address, amt, "0x", {from: creator})
        const bal = toWei("100")
        assertEqual(bal, await dataUnionSidechain.getWithdrawableEarnings(members[0]))

        //members[0] withdraws to member[1] via bridge
        await adapter.setBinanceRecipient(members[1], {from: members[0]})
        await dataUnionSidechain.withdrawAllTo(adapter.address, false, {from: members[0]})
        assertEqual(0, await dataUnionSidechain.getWithdrawableEarnings(members[0]))
        assertEqual(await testToken.balanceOf(mockBinanceMediator.address), 0)
        assertEqual(await testToken.balanceOf(members[0]), 0)
        assertEqual(await testToken.balanceOf(members[1]), bal)
    })

    it.skip("can withdraw to mediator with conversion", async () => {
        let adapter = await BinanceAdapter.new(testToken.address, uniswapRouter.options.address, mockBinanceMediator.address, otherToken.address, dummyAddress, {from: creator })
        const amt = toWei("30")
        await testToken.transferAndCall(dataUnionSidechain.address, amt, "0x", {from: creator})
        const bal = new BN(toWei("10"))
        assertEqual(bal, await dataUnionSidechain.getWithdrawableEarnings(members[0]))

        //members[0] withdraws to member[1] via bridge
        await adapter.setBinanceRecipient(members[1], {from: members[0]})
        await dataUnionSidechain.withdrawAllTo(adapter.address, false, {from: members[0]})
        assertEqual(0, await dataUnionSidechain.getWithdrawableEarnings(members[0]))
        assertEqual(await testToken.balanceOf(mockBinanceMediator.address), 0)
        assertEqual(await testToken.balanceOf(members[0]), 0)
        const otherTokenBal = await otherToken.balanceOf(members[1])
        // otherTokenBal should be a bit less than bal/10
        assert(otherTokenBal > bal.div(new BN(15)))
    })

})
