const Web3 = require("web3")
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const BN = require("bn.js")
const w3 = new Web3(web3.currentProvider)
const DataUnionMainnet = artifacts.require("./DataUnionMainnet.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")
const ERC20Mintable = artifacts.require("./ERC20Mintable.sol")

contract("DataUnionMainnet", accounts => {
    const creator = accounts[0]
    const sender = accounts[1]
    let testToken, dataUnionMainnet, mockAMB, mockTokenMediator
    const adminFeeFraction = 0.1
    const adminFeeFractionWei = w3.utils.toWei(adminFeeFraction.toString())

    const amtEth = 100
    const adminFeeEth = Math.floor(amtEth * adminFeeFraction)
    const amtWei = new BN(w3.utils.toWei(amtEth.toString()), 10)
    const adminFeeWei = new BN(w3.utils.toWei(adminFeeEth.toString()), 10)
    /*
    function initialize(
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        address _owner,
        uint256 _adminFeeFraction,
        address[] memory agents
    )
    */
    before(async () => {
        testToken = await ERC20Mintable.new("name","symbol",{ from: creator })
        await testToken.mint(sender, w3.utils.toWei("10000"), { from: creator })
        const dummy = testToken.address
        mockAMB = await MockAMB.new({from: creator})
        mockTokenMediator = await MockTokenMediator.new(testToken.address, mockAMB.address, {from: creator})
        dataUnionMainnet = await DataUnionMainnet.new({from: creator})

        await dataUnionMainnet.initialize(mockTokenMediator.address,
            dummy,
            2000000,
            dummy,
            creator,
            0,
            [creator]
        )
    }),
    describe("Basic Functions", () => {
        it("version check", async () => {
            const version = await dataUnionMainnet.version()
            assertEqual(version, 2)
        }),
        it("admin fee permissions", async () => {
            await assertFails(dataUnionMainnet.setAdminFee(w3.utils.toWei("0.1"), {from: sender}))
            //invalid, over 1:
            await assertFails(dataUnionMainnet.setAdminFee(w3.utils.toWei("1.1"), {from: creator}))
            assertEvent(await dataUnionMainnet.setAdminFee(adminFeeFractionWei, {from: creator}), "AdminFeeChanged")
            const feeFracion = await dataUnionMainnet.adminFeeFraction()
            assertEqual(+feeFracion, adminFeeFractionWei)            
        }),

        it("splits revenue correctly", async () => {
            //send revenue
            assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), amtWei)
            assertEvent(await dataUnionMainnet.sendTokensToBridge({from: creator}), "AdminFeeCharged")
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), new BN(0))
            //should do nothing
            await dataUnionMainnet.sendTokensToBridge({from: creator})
            assertEqual(+(await dataUnionMainnet.totalAdminFees()), adminFeeWei)
            assertEqual(+(await dataUnionMainnet.adminFeesWithdrawable()), new BN(0))
            assertEqual(+(await dataUnionMainnet.totalEarnings()), amtWei.sub(adminFeeWei))
            assertEqual(+(await testToken.balanceOf(creator)), adminFeeWei)

            //try same with autoSendAdminFee off:

            await assertFails(dataUnionMainnet.setAutoSendAdminFee(false, {from: sender}))
            dataUnionMainnet.setAutoSendAdminFee(false, {from: creator})

            //send revenue
            assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), amtWei)
            assertEvent(await dataUnionMainnet.sendTokensToBridge({from: creator}), "AdminFeeCharged")
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), new BN(0))
            //should do nothing
            await dataUnionMainnet.sendTokensToBridge({from: creator})
            assertEqual(+(await dataUnionMainnet.totalAdminFees()), adminFeeWei.mul(new BN(2)))
            assertEqual(+(await dataUnionMainnet.adminFeesWithdrawable()), adminFeeWei)
            assertEqual(+(await dataUnionMainnet.totalEarnings()), amtWei.sub(adminFeeWei).mul(new BN(2)))
            assertEqual(+(await testToken.balanceOf(creator)), adminFeeWei)
            await dataUnionMainnet.withdrawAdminFees({from: sender})
            assertEqual(+(await testToken.balanceOf(creator)), adminFeeWei.mul(new BN(2)))
            assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))
        })
    })
})
