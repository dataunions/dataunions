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
const DataUnionFactoryMainnet = require("../build/contracts/DataUnionFactoryMainnet.json")

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
const home_erc677 = '0x6FFA7a5B794B2A02f824689fbfFF223ad13AFF3b'
const home_erc_mediator = '0x844a0d86ec9ECE5aa104078EF6028F68a86f42d1'
const foreign_erc_mediator = '0xcd5ABf6FD59eFa7834E2510181B2c409d42752d5'
const foreign_erc20 = '0xb23dffE7267Ec8ffcE409D5623B7a73f536e7D9B'


const home_du = '0xA6Cd36220553eaA65b3AB3353b7cF6803287415B'
const foreign_du = '0x3a49633a3206606f3835974Cc695b0eC373fb83b'

//new factory:
//const foreign_du = '0x5Aa81fB577a1765bb61E4841d958bDA75b5fa789'
//const home_du = '0xBad2D444d70605f1d19b8b04621346E39359f9D0'

const home_du_factory = '0xf3D36ed474F5EE86bB3809e31Ac6aC2b5fAB1444'
const foreign_du_factory = '0xb8678223183d560280a7BEF68daAbB0E3daBd97D'

const homeBridgeTest = new Contract(home_bridgetest, BridgeTest.abi, wallet_home)
const foreignBridgeTest = new Contract(foreign_bridgetest, BridgeTest.abi, wallet_foreign)
const homeAmb = new Contract(home_amb, HomeAMB.abi, wallet_home)
const foreignAmb = new Contract(foreign_amb, ForeignAMB.abi, wallet_foreign)
const homeErc677 = new Contract(home_erc677, ERC677BridgeToken.abi, wallet_home)
const foreignErc20 = new Contract(foreign_erc20, ERC20Mintable.abi, wallet_foreign)

const homeDUFactory = new Contract(home_du_factory, DataUnionFactorySidechain.abi, wallet_home)
const foreignDUFactory = new Contract(foreign_du_factory, DataUnionFactoryMainnet.abi, wallet_foreign)

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
async function deployDUFactories(){
    log(`Deploying template DU home contract from ${wallet_home.address}`)
    let deployer = new ContractFactory(DataUnionSidechain.abi, DataUnionSidechain.bytecode, wallet_home)
    let dtx = await deployer.deploy({ gasLimit: 7900000 })
    let duhome = await dtx.deployed()
    console.log(`duhome template: ${duhome.address}`)

    log(`Deploying template DU mainnet contract from ${wallet_foreign.address}`)
    deployer = new ContractFactory(DataUnionMainnet.abi, DataUnionMainnet.bytecode, wallet_foreign)
    dtx = await deployer.deploy({ gasLimit: 7900000 })
    duforeign = await dtx.deployed()
    console.log(`duforeign template: ${duforeign.address}`)


    // constructor( address _token_mediator, address _data_union_sidechain_template) public {
    log(`Deploying sidechain DU factory contract from ${wallet_home.address}`)
    deployer = new ContractFactory(DataUnionFactorySidechain.abi, DataUnionFactorySidechain.bytecode, wallet_home)
    dtx = await deployer.deploy(home_erc_mediator, duhome.address, { gasLimit: 7900000 })
    let factSidechain = await dtx.deployed()
    console.log(`factorySidechain: ${factSidechain.address}`)

    /*
    ( address _token_mediator, 
                address _data_union_mainnet_template,
                address _data_union_sidechain_template,
                address _data_union_sidechain_factory,
                uint256 _sidechain_maxgas)
                */
        // constructor( address _token_mediator, address _data_union_sidechain_template) public {
    log(`Deploying DU mainnet factory contract from ${wallet_foreign.address}`)
    deployer = new ContractFactory(DataUnionFactoryMainnet.abi, DataUnionFactoryMainnet.bytecode, wallet_foreign)
    dtx = await deployer.deploy(foreign_erc_mediator, duforeign.address, duhome.address, factSidechain.address, 2000000, { gasLimit: 7900000 })
    let factMainnet = await dtx.deployed()
    console.log(`factMainnet: ${factMainnet.address}`)

    let tx = await factMainnet.deployNewDataUnion(wallet_foreign.address, 0, [wallet_foreign.address])
    let rslt = await tx.wait();
    console.log(`rslt ${JSON.stringify(rslt)}`)
        
    
}

async function deployDUContracts() {
    /*
    log(`Deploying DU home contract from ${wallet_home.address}`)
    let deployer = new ContractFactory(DataUnionSidechain.abi, DataUnionSidechain.bytecode, wallet_home)
    let dtx = await deployer.deploy({ gasLimit: 7900000 })
    let duhome = await dtx.deployed()
    console.log(`duhome template: ${duhome.address}`)

    
        address _token_mediator,
        address _sidechain_DU_factory,
        uint256 _sidechain_maxgas,
        address _sidechain_template_DU,
        uint256 adminFeeFraction,
        address[] memory agents
*/
    const template = await homeDUFactory.data_union_sidechain_template()

    log(`Deploying DU foreign contract from ${wallet_foreign.address}`)
    deployer = new ContractFactory(DataUnionMainnet.abi, DataUnionMainnet.bytecode, wallet_foreign)
    const agents = [wallet_foreign.address]
    dtx = await deployer.deploy(
        foreign_erc_mediator,
        home_du_factory,
        2000000,
        template,
        0,
        agents,
        { gasLimit: 7900000 })
    const duforeign = await dtx.deployed()
    console.log(`duforeign: ${duforeign.address}`)

    //tx = await duforeign.deployNewDUSidechain(0, agents)
    //await tx.wait()
    const homeaddress = await duforeign.sidechainAddress()
    console.log(`duhome: ${homeaddress}`)
    const duhome = new Contract(homeaddress, DataUnionSidechain.abi, wallet_home)

    /*
    function initialize(
    address token_address,
    uint256 adminFeeFraction_,
    address[] memory agents,
    address _token_mediator,
    address _mainchain_DU
)
    let tx
    console.log("init home contract")
    tx = await duhome.initialize(home_erc677, 0, [wallet_home.address], home_erc_mediator, duforeign.address)
    console.log(`init home contract submitted: ${JSON.stringify(tx)}`)
    await tx.wait()
    console.log(`init home contract done `)

    function initialize(
        address _amb,
        address _sidechain_DU,
        address _token,
        address _token_mediator,
        uint256 _sidechain_maxgas
    )
    console.log("init foreign contract")
    tx = await duforeign.initialize(foreign_amb, duhome.address, foreign_erc20, foreign_erc_mediator, 2000000)
    console.log(`init foreign contract submitted: ${JSON.stringify(tx)}`)
    await tx.wait()
    console.log(`init foreign contract done `)
*/
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
        //await deployForeignErc20()
        //await deployDUContracts()
        //await testSend()
        //await withdraw(member)        
        //await deployDUFactories() 
        /*
        tx = await homeDU.addMember(member)
        await tx.wait()
        console.log(`added member ${member}`)
        */

        let sc = await foreignDU.sidechainAddress()  
        console.log(`sc ${sc}`)
        let fact = await foreignDU.sidechain_DU_factory()  
        console.log(`fact ${fact}`)
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

