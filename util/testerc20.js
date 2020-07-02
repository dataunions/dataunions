const {
    Contract,
    ContractFactory,
    utils: { defaultAbiCoder, computeAddress, parseEther, formatEther },
    Wallet,
    providers: { Web3Provider, JsonRpcProvider },
    utils
} = require("ethers")
const tokenbridge_contracts = '../../tokenbridge/contracts'
const HomeAMB = require(tokenbridge_contracts + "/build/contracts/HomeAMB.json")
const ForeignAMB = require(tokenbridge_contracts + "/build/contracts/ForeignAMB.json")
const BridgeTest = require(tokenbridge_contracts + "/build/contracts/BridgeTest.json")
const ERC677BridgeToken = require(tokenbridge_contracts + "/build/contracts/ERC677BridgeToken.json")
const ERC20 = require(tokenbridge_contracts + "/build/contracts/ERC20.json")
const ERC20Mintable = require("../build/contracts/ERC20Mintable.json")
const DataUnionMainnet = require("../build/contracts/DataUnionMainnet.json")
const DataUnionSidechain = require("../build/contracts/DataUnionSidechain.json")
const DataUnionFactorySidechain = require("../build/contracts/DataUnionFactorySidechain.json")

const log = process.env.QUIET ? (() => { }) : console.log // eslint-disable-line no-console
class LoggingProvider extends JsonRpcProvider {
    perform(method, parameters) {
        console.log(">>>", method, parameters);
        return super.perform(method, parameters).then((result) => {
            console.log("<<<", method, parameters, result);
            return result;
        });
    }
}
const provider_home = new JsonRpcProvider('https://staging.streamr.com:8540');
const provider_foreign = new JsonRpcProvider('http://127.0.0.1:8545');
//const provider = new LoggingProvider('http://127.0.0.1:8545');


const wallet_home = new Wallet('0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0', provider_home)

const wallet_foreign = new Wallet('0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0', provider_foreign)

//const wallet = new Wallet('0x5f348fe23657a691702e8f55578fc6a875eab16199bfdff7ed2c6d926a6b5dba', provider)
const futureTime = 4449513600
const home_amb = '0xA9A988fAd795CAFF275Cc054e94283BBb953a386'
const foreign_amb = '0xE4eA76e830a659282368cA2e7E4d18C4AE52D8B3'
const home_bridgetest = '0x604D72069f5b591f7DF96e11bDbEB4C68E5d3C5b'
const foreign_bridgetest = '0x00E680d549FE53a627a3db86a6F88fA2471CFfAa'
const home_erc677 = '0x3FFaa62E10d8A2B3F37d26ABBA3a5E1ce8248325'
const home_erc_mediator = '0x4A6D5e831B8f824686D52b809399BCa4Fb036882'
const foreign_erc_mediator = '0xDa6fB5F5ED2DD586C78e8cbD7228A3a8206af5b1'
const foreign_erc20 = '0xED56b560D42917185A829789C3eF1E118a421Acc'
const home_du = '0xf0cDf673b5CF0633Ac5210b6f62cc699CA6DC05C'
const foreign_du = '0xaea6245Cd5A7f69bA0892e806e50DC60afC8B3c2'
const home_du_factory = '0xB21572BBC5CEf6E08F16b6Db015bD3B5a4d73762'

const homeBridgeTest = new Contract(home_bridgetest, BridgeTest.abi, wallet_home)
const foreignBridgeTest = new Contract(foreign_bridgetest, BridgeTest.abi, wallet_foreign)
const homeAmb = new Contract(home_amb, HomeAMB.abi, wallet_home)
const foreignAmb = new Contract(foreign_amb, ForeignAMB.abi, wallet_foreign)
const homeErc677 = new Contract(home_erc677, ERC677BridgeToken.abi, wallet_home)
const foreignErc20 = new Contract(foreign_erc20, ERC20Mintable.abi, wallet_foreign)

const homeDUFactory = new Contract(home_du_factory, DataUnionFactorySidechain.abi, wallet_home)
const homeDU = new Contract(home_du, DataUnionSidechain.abi, wallet_home)
const foreignDU = new Contract(foreign_du, DataUnionMainnet.abi, wallet_foreign)
const member = '0x4178baBE9E5148c6D5fd431cD72884B07Ad855a0'

async function deployForeignErc20() {
    log(`Deploying foreign Erc20 contract from ${wallet_foreign.address}`)
    let deployer = new ContractFactory(ERC20Mintable.abi, ERC20Mintable.bytecode, wallet_foreign)
    let dtx = await deployer.deploy("dc", "data", { gasLimit: 7900000 })
    const erc20 = await dtx.deployed()
    console.log(`erc20: ${erc20.address}`)
    let amt = "1000000000000000000000000"
    let tx = await erc20.mint(wallet_foreign.address, amt)
    await tx.wait()
    console.log(`minted ${amt}`)
}
async function deployDUSidechainFactory(){
/*
    // constructor( address _token_mediator, address _data_union_sidechain_template) public {
    log(`Deploying DU factory contract from ${wallet_home.address}`)
    let deployer = new ContractFactory(DataUnionFactorySidechain.abi, DataUnionFactorySidechain.bytecode, wallet_home)
    let dtx = await deployer.deploy(home_erc_mediator, home_du, { gasLimit: 7900000 })
    const fact = await dtx.deployed()
*/
    let fact = homeDUFactory
    console.log(`factory: ${fact.address}`)
    //function deployMinimal(address _logic, bytes memory _data, bytes32 salt)
    let salt = utils.hexZeroPad('0x1', 32)  
    let pa = await fact.predictAddressCreate2(home_du, salt)
    console.log(`predicted ${pa}`)
    let tx = await fact.deployMinimal(home_du,'0x',salt)
    let rslt = await tx.wait();
    console.log(`rslt ${JSON.stringify(rslt)}`)

}

async function deployDUContracts() {
    log(`Deploying DU home contract from ${wallet_home.address}`)
    let deployer = new ContractFactory(DataUnionSidechain.abi, DataUnionSidechain.bytecode, wallet_home)
    let dtx = await deployer.deploy({ gasLimit: 7900000 })
    const duhome = await dtx.deployed()
    console.log(`duhome: ${duhome.address}`)


    log(`Deploying DU foreign contract from ${wallet_foreign.address}`)
    deployer = new ContractFactory(DataUnionMainnet.abi, DataUnionMainnet.bytecode, wallet_foreign)
    dtx = await deployer.deploy({ gasLimit: 7900000 })
    const duforeign = await dtx.deployed()
    console.log(`duforeign: ${duforeign.address}`)

    /*
function initialize(
    address token_address,
    uint256 adminFeeFraction_,
    address[] memory agents,
    address _token_mediator,
    address _mainchain_DU
)
    */
    let tx
    console.log("init home contract")
    tx = await duhome.initialize(home_erc677, 0, [wallet_home.address], home_erc_mediator, duforeign.address)
    console.log(`init home contract submitted: ${JSON.stringify(tx)}`)
    await tx.wait()
    console.log(`init home contract done `)
    /*

    function initialize(
        address _amb,
        address _sidechain_DU,
        address _token,
        address _token_mediator,
        uint256 _sidechain_maxgas
    )
    */
    console.log("init foreign contract")
    tx = await duforeign.initialize(foreign_amb, duhome.address, foreign_erc20, foreign_erc_mediator, 2000000)
    console.log(`init foreign contract submitted: ${JSON.stringify(tx)}`)
    await tx.wait()
    console.log(`init foreign contract done `)
    return [duhome, duforeign]
}

async function testSend() {
    let tx
    //    const [duhome, duforeign] = await deployDUContracts()
    const [duhome, duforeign] = [homeDU, foreignDU]
/*
    const memb = '0xdC353aA3d81fC3d67Eb49F443df258029B01D8aB'
    tx = await duhome.addMember(memb)
    await tx.wait()
    console.log(`added member ${memb}`)
*/    
    const bal = await foreignErc20.balanceOf(wallet_foreign.address)
    console.log(`bal ${bal}`)

    let amt = "1000000000000000000"
    //transfer ERC20 to mainet contract
    tx = await foreignErc20.transfer(duforeign.address, amt)
    await tx.wait()
    console.log(`transferred ${amt} to ${duforeign.address}`)
    console.log(`sending to bridge`)
    //sends tokens to sidechain contract via bridge, calls sidechain.addRevenue()
    tx = await duforeign.sendTokensToBridge()
    await tx.wait()

}
async function withdraw(address){
    console.log(`withdraw for ${address}`)
    tx = await homeDU.withdraw(address, true)
    await tx.wait()
    console.log(`withdraw submitted for ${address}`)
}
async function start() {
    let tx
    try {

        //await testSend()
        //await withdraw(member)        
        await deployDUSidechainFactory()     
        let bal = await foreignErc20.balanceOf(member)
        console.log(`${member} foreign token bal ${bal}`)
        bal = await homeErc677.balanceOf(member)
        console.log(`${member} home token bal ${bal}`)
        bal = await homeDU.getWithdrawableEarnings(member)
        console.log(`${member} home DU withdrawable ${bal}`)
        bal = await homeDU.totalEarnings()
        console.log(`total earnings DU home ${bal}`)
        bal = await homeErc677.balanceOf(homeDU.address)
        console.log(`home DU token bal ${bal}`)

    }
    catch (err) {
        console.error(err)
    }
}
start()

