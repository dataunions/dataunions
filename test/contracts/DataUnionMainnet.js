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
    let testToken, dataUnionSidechain
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
        it("admin fee permissions", async () => {
            await assertFails(dataUnionMainnet.setAdminFee(w3.utils.toWei("0.1"), {from: sender}))
            //invalid, over 1:
            await assertFails(dataUnionMainnet.setAdminFee(w3.utils.toWei("1.1"), {from: creator}))
            assertEvent(await dataUnionMainnet.setAdminFee(adminFeeFractionWei, {from: creator}), "AdminFeeChanged")
        }),

        it("splits revenue correctly", async () => {
            
            //send revenue to members[]
            assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), amtWei)
            assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), amtWei.mul(new BN(2)))
            assertEvent(await dataUnionMainnet.sendTokensToBridge({from: creator}), "AdminFeeCharged")
            assertEqual(+(await dataUnionMainnet.unaccountedTokens()), new BN(0))
            //should do nothing
            await dataUnionMainnet.sendTokensToBridge({from: creator})
            assertEqual(+(await dataUnionMainnet.totalAdminFees()), adminFeeWei.mul(new BN(2)))
            assertEqual(+(await dataUnionMainnet.adminFeesWithdrawable()), new BN(0))
            assertEqual(+(await dataUnionMainnet.totalEarnings()), amtWei.sub(adminFeeWei).mul(new BN(2)))
            assertEqual(+(await testToken.balanceOf(creator)), adminFeeWei.mul(new BN(2)))
            
            
        }),
        it("adminFee withdrawal works", async () => {
            /*
            // test admin fee withdraw
            const ownerTokenBefore = await testToken.balanceOf(creator)
            //no access
            await assertFails(dataUnionSidechain.withdrawAdminFees(false, {from: unused[1]}))

            assertEvent(await dataUnionSidechain.withdrawAdminFees(false, {from: creator}), "AdminFeesWithdrawn")
            //should do nothing:
            await dataUnionSidechain.withdrawAdminFees(false,{from: creator})
            const ownerTokenAfter = await testToken.balanceOf(creator)
            assertEqual(ownerTokenAfter.sub(ownerTokenBefore), adminFeeWei.mul(new BN(3)))
            */
        })
    })
})
