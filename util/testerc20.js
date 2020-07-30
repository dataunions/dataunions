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
const provider_home = new JsonRpcProvider('http://10.200.10.1:8546')
const provider_foreign = new JsonRpcProvider('http://10.200.10.1:8545')

const wallet_home = new Wallet('0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0', provider_home)

const wallet_foreign = new Wallet('0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0', provider_foreign)

//const wallet = new Wallet('0x5f348fe23657a691702e8f55578fc6a875eab16199bfdff7ed2c6d926a6b5dba', provider)
const futureTime = 4449513600
const home_amb = '0xE4eA76e830a659282368cA2e7E4d18C4AE52D8B3'
const foreign_amb = '0xD13D34d37e2c94cb35EA8D5DE7498Cb7830d26e0'
const home_erc677 = '0x3b11D489411BF11e843Cb28f8824dedBfcB75Df3'
const home_erc_mediator = '0x6cCdd5d866ea766f6DF5965aA98DeCCD629ff222'
const foreign_erc_mediator = '0x3AE0ad89b0e094fD09428589849C161f0F7f4E6A'
const foreign_erc20 = '0xbAA81A0179015bE47Ad439566374F2Bae098686F'


const home_du = '0x0dbeB5A3A9C280596b4C39bF4e5001566aBD4F54'
const foreign_du = '0xa06212C113AC6D5A06833928a94f561fAb13e079'

//new factory:
//const foreign_du = '0x5Aa81fB577a1765bb61E4841d958bDA75b5fa789'
//const home_du = '0xBad2D444d70605f1d19b8b04621346E39359f9D0'

const home_du_factory = '0xA90CeCcA042312b8f2e8B924C04Ce62516CBF7b2'
const foreign_du_factory = '0xb23dffE7267Ec8ffcE409D5623B7a73f536e7D9B'

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

async function deployDU(duname) {
    let factMainnet = new Contract(foreign_du_factory , DataUnionFactoryMainnet.abi, wallet_foreign)
    let tx = await factMainnet.deployNewDataUnion(wallet_foreign.address, 0, [wallet_foreign.address], duname)
    let rslt = await tx.wait();
    let mainnet_addresss = await factMainnet.mainnetAddress(wallet_foreign.address, duname)
    console.log(`rslt ${JSON.stringify(rslt)}`)
    console.log(`mainnet_addresss ${mainnet_addresss}`)
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
//        await deployDU("t0")
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

