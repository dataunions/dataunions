const Web3 = require("web3")
const { assertEqual, assertFails, assertEvent } = require("../utils/web3Assert")
const BN = require("bn.js")
const w3 = new Web3(web3.currentProvider)
const DataUnionMainnet = artifacts.require("./DataUnionMainnet.sol")
const MockTokenMediator = artifacts.require("./MockTokenMediator.sol")
const MockAMB = artifacts.require("./MockAMB.sol")
const TestToken = artifacts.require("./TestToken.sol")

contract("DataUnionMainnet", accounts => {
    const creator = accounts[0]
    const sender = accounts[1]
    let testToken, dataUnionMainnet, mockAMB, mockTokenMediator
    const adminFeeFraction = 0.1
    const duFeeFraction = 0.1
    const duBeneficiary = accounts[2]

    const adminFeeFractionWei = w3.utils.toWei(adminFeeFraction.toString())
    const duFeeFractionWei = w3.utils.toWei(duFeeFraction.toString())

    const amtEth = 100
    const amtWei = new BN(w3.utils.toWei(amtEth.toString()), 10)
    const adminFeeEth = Math.floor(amtEth * adminFeeFraction)
    const adminFeeWei = new BN(w3.utils.toWei(adminFeeEth.toString()), 10)
    const duFeeEth = Math.floor(amtEth * adminFeeFraction)
    const duFeeWei = new BN(w3.utils.toWei(duFeeEth.toString()), 10)

    before(async () => {
        testToken = await TestToken.new("name","symbol",{ from: creator })
        await testToken.mint(sender, w3.utils.toWei("10000"), { from: creator })
        mockAMB = await MockAMB.new({from: creator})
        mockTokenMediator = await MockTokenMediator.new(testToken.address, mockAMB.address, {from: creator})
    })

    beforeEach(async () => {
        /*function initialize(
            address _token,
            address _mediator,
            address _sidechainDUFactory,
            uint256 _sidechainMaxGas,
            address _sidechainDUTemplate,
            address _owner,
            uint256 _adminFeeFraction,
            uint256 _duFeeFraction,
            address _duBeneficiary,
            address[] memory agents
        )*/
        dataUnionMainnet = await DataUnionMainnet.new({from: creator})
        const dummy = testToken.address
        await dataUnionMainnet.initialize(
            testToken.address,
            mockTokenMediator.address,
            dummy,
            2000000,
            dummy,
            creator,
            adminFeeFractionWei,
            duFeeFractionWei,
            duBeneficiary,
            [creator],
            {from: creator}
        )
    })

    it("uses version 2", async () => {
        const version = await dataUnionMainnet.version()
        assertEqual(version, 2)
    })

    it("checks permissions", async () => {
        await assertFails(dataUnionMainnet.setFees("0", "0", {from: sender}))
        await assertFails(dataUnionMainnet.setAutoSendFees(false, {from: sender}))
    })

    it("checks fee total < 100%", async () => {
        await assertFails(dataUnionMainnet.setFees(w3.utils.toWei("0.9"), w3.utils.toWei("0.2"), {from: creator}))
    })

    it("sets fees correctly", async () => {
        assertEvent(await dataUnionMainnet.setFees("0", "0", {from: creator}), "FeesChanged")
        assertEqual(await dataUnionMainnet.adminFeeFraction(), 0)
        assertEqual(await dataUnionMainnet.dataUnionFeeFraction(), 0)
        assertEvent(await dataUnionMainnet.setFees(adminFeeFractionWei, duFeeFractionWei, {from: creator}), "FeesChanged")
        assertEqual(await dataUnionMainnet.adminFeeFraction(), adminFeeFractionWei)
        assertEqual(await dataUnionMainnet.dataUnionFeeFraction(), duFeeFractionWei)
    })

    it("splits revenue correctly with ERC677 transferAndCall when autoSendFees=false", async () => {
        dataUnionMainnet.setAutoSendFees(false, {from: creator})
        const balanceBefore = await testToken.balanceOf(creator)
        const duBeneficiaryBalanceBefore = await testToken.balanceOf(duBeneficiary)

        // send revenue with transferAndCall. Don't distribute fees automatically (slightly cheaper transferAndCall)
        assertEqual(await dataUnionMainnet.totalAdminFees(), 0)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), 0)
        assert(await testToken.transferAndCall(dataUnionMainnet.address, amtWei, [], {from: sender}))
        assertEqual(await dataUnionMainnet.totalAdminFees(), adminFeeWei)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), duFeeWei)
        assertEqual(await dataUnionMainnet.adminFeesWithdrawable(), adminFeeWei)
        assertEqual(await dataUnionMainnet.dataUnionFeesWithdrawable(), duFeeWei)

        // manual withdraw
        assertEqual(await testToken.balanceOf(creator), balanceBefore)
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore)
        await dataUnionMainnet.withdrawAdminFees({from: sender})
        assertEqual(await testToken.balanceOf(creator), balanceBefore.add(adminFeeWei))
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore)
        await dataUnionMainnet.withdrawDataUnionFees({from: sender})

        // fees are withdrawn now
        assertEqual(await testToken.balanceOf(creator), balanceBefore.add(adminFeeWei))
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore.add(duFeeWei))
        assertEqual(await dataUnionMainnet.totalAdminFees(), adminFeeWei)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), duFeeWei)
        assertEqual(await dataUnionMainnet.adminFeesWithdrawable(), 0)
        assertEqual(await dataUnionMainnet.dataUnionFeesWithdrawable(), 0)
    })

    it("splits revenue correctly with ERC677 transferAndCall when autoSendFees=true", async () => {
        dataUnionMainnet.setAutoSendFees(true, {from: creator})
        const balanceBefore = await testToken.balanceOf(creator)
        const duBeneficiaryBalanceBefore = await testToken.balanceOf(duBeneficiary)

        // send revenue with transferAndCall
        assertEqual(await dataUnionMainnet.totalAdminFees(), 0)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), 0)
        assert(await testToken.transferAndCall(dataUnionMainnet.address, amtWei, [], {from: sender}))

        // fees were automatically paid
        assertEqual(await testToken.balanceOf(creator), balanceBefore.add(adminFeeWei))
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore.add(duFeeWei))
        assertEqual(await dataUnionMainnet.totalAdminFees(), adminFeeWei)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), duFeeWei)
        assertEqual(await dataUnionMainnet.adminFeesWithdrawable(), 0)
        assertEqual(await dataUnionMainnet.dataUnionFeesWithdrawable(), 0)
    })

    it("splits revenue correctly with plain ERC20 transfer + sendTokensToBridge", async () => {
        dataUnionMainnet.setAutoSendFees(true, {from: creator})
        const balanceBefore = await testToken.balanceOf(creator)
        const duBeneficiaryBalanceBefore = await testToken.balanceOf(duBeneficiary)

        // send revenue with transfer, must call sendTokensToBridge() manually
        assertEqual(await dataUnionMainnet.totalAdminFees(), 0)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), 0)
        assert(await testToken.transfer(dataUnionMainnet.address, amtWei, {from: sender}))

        // fees not visible before sendTokensToBridge() because transfer doesn't allow "callbacks"
        assertEqual(await dataUnionMainnet.totalAdminFees(), 0)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), 0)
        assertEqual(await testToken.balanceOf(creator), balanceBefore)
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore)

        // sending over the bridge
        assertEqual(await dataUnionMainnet.unaccountedTokens(), amtWei)
        assertEqual(await dataUnionMainnet.tokensSentToBridge(), 0)
        await dataUnionMainnet.sendTokensToBridge({from: creator})
        assertEqual(await dataUnionMainnet.unaccountedTokens(), 0)
        assertEqual(await dataUnionMainnet.tokensSentToBridge(), amtWei.sub(adminFeeWei).sub(duFeeWei))

        assertEqual(await dataUnionMainnet.totalAdminFees(), adminFeeWei)
        assertEqual(await dataUnionMainnet.totalDataUnionFees(), duFeeWei)
        assertEqual(await dataUnionMainnet.adminFeesWithdrawable(), 0)
        assertEqual(await dataUnionMainnet.dataUnionFeesWithdrawable(), 0)

        assertEqual(await testToken.balanceOf(creator), balanceBefore.add(adminFeeWei))
        assertEqual(await testToken.balanceOf(duBeneficiary), duBeneficiaryBalanceBefore.add(duFeeWei))
    })
})
