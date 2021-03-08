//addresses from docker setup
const ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY = "5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
const DATACOIN_ADDRESS = "0xbAA81A0179015bE47Ad439566374F2Bae098686F"
const HOME_ERC677_MEDIATOR = "0xedD2aa644a6843F2e5133Fe3d6BD3F4080d97D9F"
const FOREIGN_ERC677_MEDIATOR = "0xedD2aa644a6843F2e5133Fe3d6BD3F4080d97D9F"
const HOME_ERC677 = "0x73Be21733CC5D08e1a14Ea9a399fb27DB3BEf8fF"
const HOME_MULTIMEDIATOR = "0x41B89Db86BE735c03A9296437E39F5FDAdC4c678"
const FOREIGN_MULTIMEDIATOR = "0x6346Ed242adE018Bd9320D5E3371c377BAB29c31"



const Token = require("../../build/contracts/IERC20.json")
const DataUnionSidechain = require("../../build/contracts/DataUnionSidechain.json")
const DataUnionMainnet = require("../../build/contracts/DataUnionMainnet.json")

const ITokenMediator = require("../../build/contracts/ITokenMediator.json")
const IMultiTokenMediator = require("../../build/contracts/IMultiTokenMediator.json")
const IAMB = require("../../build/contracts/IAMB.json")
//const MainnetMigrationManager = require("../../build/contracts/MainnetMigrationManager.json")
//const SidechainMigrationManager = require("../../build/contracts/SidechainMigrationManager.json")
const TestToken = require("../../build/contracts/TestToken.json")
const {
    Contract,
    ContractFactory,
    Wallet,
    BigNumber,
    providers: { JsonRpcProvider },
    utils: { keccak256, Interface, id }
} = require("ethers")

const assert = require("assert")
const until = require("../../util/await-until")
const {
    requiredSignaturesHaveBeenCollected,
    transportSignatures,
} = require("../utils/transportSignatures")

const log = require("debug")("Streamr:du:test:e2e:plain")
// require("debug").log = console.log.bind(console)  // get logging into stdout so mocha won't hide it

const {
    deployDataUnion,
    deployDataUnionFactorySidechain,
    deployDataUnionFactoryMainnet,
    getTemplateSidechain,
    deployMainnetMigrationManager,
    deploySidechainMigrationManager
} = require("../../util/libDU")

const providerSidechain = new JsonRpcProvider({
    url: "http://10.200.10.1:8546",
    timeout: process.env.TEST_TIMEOUT,
})
const providerMainnet = new JsonRpcProvider({
    url: "http://10.200.10.1:8545",
    timeout: process.env.TEST_TIMEOUT,
})
const walletSidechain = new Wallet(ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY, providerSidechain)
const walletMainnet = new Wallet(ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY, providerMainnet)

const erc677Sidechain = new Contract(HOME_ERC677, Token.abi, walletSidechain)
const erc20Mainnet = new Contract(DATACOIN_ADDRESS, Token.abi, walletMainnet)
const homeMediator = new Contract(HOME_ERC677_MEDIATOR, ITokenMediator.abi, walletSidechain)
const foreignMediator = new Contract(FOREIGN_ERC677_MEDIATOR, ITokenMediator.abi, walletMainnet)
const homeMultiMediator = new Contract(HOME_MULTIMEDIATOR, IMultiTokenMediator.abi, walletSidechain)
const foreignMultiMediator = new Contract(FOREIGN_MULTIMEDIATOR, IMultiTokenMediator.abi, walletMainnet)
const payForSignatureTransport = true
const userRequestForSignatureEventTopic = id("UserRequestForSignature(bytes32,bytes)")
const userRequestForSignatureInterface = new Interface(["event UserRequestForSignature(bytes32 indexed messageId, bytes encodedData)"])
let factoryMainnet, mainnetAmb, sidechainAmb, mainnetMigrationMgr, sidechainMigrationMgr
//const zeroAddress = "0x0000000000000000000000000000000000000000"

describe("Data Union tests using only ethers.js directly", () => {

    before(async function () {
        this.timeout(process.env.TEST_TIMEOUT || 60000)
        mainnetMigrationMgr = await deployMainnetMigrationManager(walletMainnet)
        sidechainMigrationMgr = await deploySidechainMigrationManager(walletSidechain) 
        const factorySidechain = await deployDataUnionFactorySidechain(walletSidechain, sidechainMigrationMgr.address)
        const templateSidechain = getTemplateSidechain()
        factoryMainnet = await deployDataUnionFactoryMainnet(walletMainnet, templateSidechain.address, factorySidechain.address, mainnetMigrationMgr.address)
        log(`Deployed factory contracts sidechain ${factorySidechain.address}, mainnet ${factoryMainnet.address}`)
        const HOME_AMB = await homeMediator.bridgeContract()
        const FOREIGN_AMB = await foreignMediator.bridgeContract()
        mainnetAmb = new Contract(HOME_AMB, IAMB.abi, walletSidechain)
        sidechainAmb = new Contract(FOREIGN_AMB, IAMB.abi, walletMainnet)
    })

    it("can deploy, add members and withdraw, migrate and withdraw in new token", async function () {
        this.timeout(process.env.TEST_TIMEOUT || 300000)
        const member = "0x4178baBE9E5148c6D5fd431cD72884B07Ad855a0"
        const member2 = "0x0101010101010101010010101010101001010101"
        const duname = "test" + Date.now()
        const sendAmount = "1000000000000000000"
        const duMainnet = await deployDataUnion(duname, 0, factoryMainnet, providerSidechain, process.env.TEST_TIMEOUT || 240000)
        const sidechainAddress = await factoryMainnet.sidechainAddress(duMainnet.address)
        const duSidechain = new Contract(
            sidechainAddress,
            DataUnionSidechain.abi,
            walletSidechain
        )

        const version = await duMainnet.version()
        log(`working with DU named ${duname}, mainnet_address = ${duMainnet.address}, sidechain_address = ${sidechainAddress}`)
        log(`version = ${version}`)
        const balanceBefore = await erc20Mainnet.balanceOf(member)

        await printStats(duSidechain, member)
        await addMembers(duSidechain, [member, member2])
        await printStats(duSidechain, member)
        await testSend(duMainnet, duSidechain, sendAmount)
        await printStats(duSidechain, member)
        await withdraw(duSidechain, member)
        await printStats(duSidechain, member)

        const balanceAfter = await erc20Mainnet.balanceOf(member)
        log(`balanceBefore ${balanceBefore} balanceAfter ${balanceAfter} sendAmount ${sendAmount}`)
        assert(balanceAfter.sub(balanceBefore).eq(BigNumber.from(sendAmount).div(2)))
        //assert.equal(balanceAfter.sub(balanceBefore).toString(), bigNumberify(sendAmount).div("2").toString())


        //test migrate
        const testAmount = "100000000000000000000"
        const testToken = await deployTestToken(walletMainnet, BigNumber.from(testAmount))
        log("testing migrate to new token")
        let homeAddress
        await until(async () => {
            try {
                homeAddress = await homeMultiMediator.homeTokenAddress(testToken.address)
                log(`homeMultiMediator Token ${homeAddress}`)
                return homeAddress != 0
            }
            catch (err) {
                log("ERR " + err)
            }
            return false
        }, 360000)
        let tx
        log("migrate DU sidechain")
        tx = await sidechainMigrationMgr.setCurrentToken(homeAddress)
        await tx.wait()
        tx = await sidechainMigrationMgr.setOldToken(erc677Sidechain.address)
        await tx.wait()
        tx = await sidechainMigrationMgr.setCurrentMediator(HOME_MULTIMEDIATOR)
        await tx.wait()
        tx = await duSidechain.migrate({gasLimit: 4000000})
        await tx.wait()
        log("migrated")

        log("migrate DU mainnet")
        tx = await mainnetMigrationMgr.setCurrentToken(testToken.address)
        await tx.wait()
        tx = await mainnetMigrationMgr.setCurrentMediator(FOREIGN_MULTIMEDIATOR)
        await tx.wait()
        tx = await duMainnet.migrate({gasLimit: 4000000})
        await tx.wait()
        log("migrated")


        
        await withdraw(duSidechain, member2)
        let balanceAfter2 = await testToken.balanceOf(member2)
        log("checking balance in new token on mainnet")
        assert(balanceAfter2.eq(BigNumber.from(sendAmount).div(2)))

        //now that we've migrated, testSend sends the new token
        log("sending new token on mainnet")
        await testSend(duMainnet, duSidechain, sendAmount)
        await withdraw(duSidechain, member2)
        balanceAfter2 = await testToken.balanceOf(member2)
        log("checking balance in new token on mainnet")
        // should receive 2 * 1/2 sendAmounts
        assert(balanceAfter2.eq(BigNumber.from(sendAmount)))
    })

})

// goes over bridge => extra wait
// duSidechain needed just for the wait!
async function testSend(duMainnet, duSidechain, tokenWei) {
    const [mainnetToken, sidechainToken] = await getTokenContracts(duMainnet)

    const bal = await mainnetToken.balanceOf(walletMainnet.address)
    log(`User wallet mainnet balance ${bal}`)

    //transfer ERC20 to mainet contract
    const tx1 = await mainnetToken.transfer(duMainnet.address, tokenWei)
    await tx1.wait()
    log(`Transferred ${tokenWei} ${mainnetToken.address} to ${duMainnet.address}, sending to bridge`)

    //sends tokens to sidechain contract via bridge, calls sidechain.refreshRevenue()
    const duSideBalanceBefore = await duSidechain.totalEarnings()
    const tx2 = await duMainnet.sendTokensToBridge()
    await tx2.wait()


    log(`Sent to bridge, waiting for the tokens to appear at ${duSidechain.address} in sidechain`)

    await until(async () => {
        try {
            const ercbal = await sidechainToken.balanceOf(duSidechain.address)
            let rslt = !duSideBalanceBefore.eq(await duSidechain.totalEarnings())
            log(`Sidechain ERC677 balance ${ercbal} ${rslt}`)
            return rslt
        }
        catch (err) {
            log("ERR " + err)
        }
        return false
    }, 360000)

    log(`Confirmed DU sidechain balance ${duSideBalanceBefore} -> ${await duSidechain.totalEarnings()}`)
}

async function getSidechainDu(mainnetDu){
    const sidechainDu = await mainnetDu.sidechainAddress()
    return new Contract(
        sidechainDu,
        DataUnionSidechain.abi,
        walletSidechain
    )
}

async function getMainnetDu(sidechainDu){
    const mainnetDu = await sidechainDu.dataUnionMainnet()
    return new Contract(
        mainnetDu,
        DataUnionMainnet.abi,
        walletMainnet
    )
}

async function getTokenContracts(mainnetDu){
    const mainnetTokenAddress = await mainnetDu.token()
    const mainnetToken = new Contract(
        mainnetTokenAddress,
        Token.abi,
        walletMainnet
    )
    const sidechainDu = await getSidechainDu(mainnetDu)
    const sidechainTokenAddress = await sidechainDu.token()
    const sidechainToken = new Contract(
        sidechainTokenAddress,
        Token.abi,
        walletSidechain
    ) 
    return [mainnetToken, sidechainToken]
}

// goes over bridge => extra wait
async function withdraw(duSidechain, member) {
    const duMainnet = await getMainnetDu(duSidechain)
    const [mainnetToken, sidechainToken] = await getTokenContracts(duMainnet)
    const balanceBefore = await mainnetToken.balanceOf(member)
    const earnings = await duSidechain.getWithdrawableEarnings(member)
    log(`withdraw for ${member} (mainnet balance ${balanceBefore}) (earnings ${earnings})`)
    const owner = await duSidechain.owner()
    log(`du owner ${owner}`)
    const tx = await duSidechain.withdrawAll(member, true)
    const tr = await tx.wait()

    if (payForSignatureTransport) {
        log(`Got receipt, filtering UserRequestForSignature from ${tr.events.length} events...`)
        log(`tr: ${JSON.stringify(tr)}`)
        // event UserRequestForSignature(bytes32 indexed messageId, bytes encodedData);
        const sigEventArgsArray = tr.events.filter((e) => e.topics[0] === userRequestForSignatureEventTopic)
        if (sigEventArgsArray.length < 1) {
            throw new Error("No UserRequestForSignature events emitted from withdraw transaction, can't transport withdraw to mainnet")
        }
        /* eslint-disable no-await-in-loop */
        // eslint-disable-next-line no-restricted-syntax
        log(`sigEventArgsArray: ${JSON.stringify(sigEventArgsArray)}`)
        for (var event of sigEventArgsArray) {
            log(`event: ${JSON.stringify(event)}`)
            const sigEvent = userRequestForSignatureInterface.parseLog(event)
            log(`sigEvent: ${JSON.stringify(sigEvent)}`)

            const messageId = sigEvent.args[0]
            const messageHash = keccak256(sigEvent.args[1])

            log(`Waiting until sidechain AMB has collected required signatures for hash=${messageHash}...`)
            await until(async () => requiredSignaturesHaveBeenCollected(messageHash, mainnetAmb),360000)

            log(`Checking mainnet AMB hasn't already processed messageId=${messageId}`)
            const alreadySent = await mainnetAmb.messageCallStatus(messageId)
            const failAddress = await mainnetAmb.failedMessageSender(messageId)
            if (alreadySent || failAddress !== "0x0000000000000000000000000000000000000000") { // zero address means no failed messages
                log(`WARNING: Mainnet bridge has already processed withdraw messageId=${messageId}`)
                log("This could happen if payForSignatureTransport=true, but bridge operator also pays for signatures, and got there before your client")
                continue
            }

            log(`Transporting signatures for hash=${messageHash}`)
            await transportSignatures(messageHash, duSidechain.signer, mainnetAmb, sidechainAmb)
        }
        /* eslint-enable no-await-in-loop */
    }

    log(`withdraw submitted for ${member}, waiting to receive the tokens on the mainnet side...`)
    await until(async () => !balanceBefore.eq(await mainnetToken.balanceOf(member)), 360000)
}

// "instant" in that it doesn't go over bridge
async function addMembers(duSidechain, members) {
    const tx = await duSidechain.addMembers(members)
    await tx.wait()
    log(`Added members ${members} to DU ${duSidechain.address}`)
}

/*
    create testToken and send across multiTokenBridge to sidechainMigrationManager
*/
async function deployTestToken(wallet, amt) {
    const templateDeployer = new ContractFactory(TestToken.abi, TestToken.bytecode, wallet)
    const templateTx = await templateDeployer.deploy("test","tst", { gasLimit: 6000000 })
    const testToken = await templateTx.deployed()
    //mint amt to wallet + send amt to foreignMultiMediator
    let tx = await testToken.mint(wallet.address, amt.mul(2))
    await tx.wait()

    //send coins to sidechainMigrationMgr via multiTokenMediator
    tx = await testToken.approve(foreignMultiMediator.address, amt)
    await tx.wait()
    log(`relaying ${amt} test tokens to sidechainMigrationMgr`)
    tx = await foreignMultiMediator.relayTokens(testToken.address, sidechainMigrationMgr.address, amt )
    await tx.wait()
    log(`created TestToken ${testToken.address}, minted ${amt}, relayed to sidechainMigrationMgr`)
    return testToken
}

async function printStats(duSidechain, member) {
    const duMainnet = await getMainnetDu(duSidechain)
    const [mainnetToken, sidechainToken] = await getTokenContracts(duMainnet)
    log(`mainnetToken ${mainnetToken.address} sidechainToken ${sidechainToken.address}`)
    const bal1 = await mainnetToken.balanceOf(member)
    log(`${member} mainnet balance ${bal1}`)
    const bal2 = await sidechainToken.balanceOf(member)
    log(`${member} side-chain balance ${bal2}`)

    const memberData = await duSidechain.memberData(member)
    if (memberData.status === 0) {
        log(`${member} is not in DU ${duSidechain.address}`)
    } else {
        const bal3 = await duSidechain.getWithdrawableEarnings(member)
        log(`${member} side-chain withdrawable ${bal3}`)
        const bal4 = await duSidechain.totalEarnings()
        log(`${member} side-chain total earnings ${bal4}`)
    }

    const bal5 = await sidechainToken.balanceOf(duSidechain.address)
    log(`side-chain DU ${duSidechain.address} token balance ${bal5}`)
}
