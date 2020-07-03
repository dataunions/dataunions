const fetch = require("node-fetch")
const fs = require("fs")
const {
    Contract,
    ContractFactory,
    utils: { defaultAbiCoder, computeAddress, parseEther, formatEther },
    Wallet,
    providers: { Web3Provider, JsonRpcProvider }
} = require("ethers")
const ganache = require("ganache-core")

const HomeAMB = require("./build/contracts/HomeAMB.json")
const ForeignAMB = require("./build/contracts/ForeignAMB.json")
const BridgeTest = require("./build/contracts/BridgeTest.json")

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
//const provider = new JsonRpcProvider('https://staging.streamr.com:8540');
const provider = new JsonRpcProvider('http://127.0.0.1:8545');
//const provider = new LoggingProvider('http://127.0.0.1:8545');


const wallet = new Wallet('0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0', provider)
//const wallet = new Wallet('0x5f348fe23657a691702e8f55578fc6a875eab16199bfdff7ed2c6d926a6b5dba', provider)
const futureTime = 4449513600
const home_amb ='0xA9A988fAd795CAFF275Cc054e94283BBb953a386'
const foreign_amb ='0xE4eA76e830a659282368cA2e7E4d18C4AE52D8B3'
const home_bridgetest='0x604D72069f5b591f7DF96e11bDbEB4C68E5d3C5b'
const foreign_bridgetest='0x00E680d549FE53a627a3db86a6F88fA2471CFfAa'

async function start() {
    /*
    log(`Deploying BridgeTest contract from ${wallet.address}`)
    const deployer = new ContractFactory(BridgeTest.abi, BridgeTest.bytecode, wallet)
    const dtx = await deployer.deploy({gasLimit: 7900000} )
    const bridgetest = await dtx.deployed()
    console.log(`bridgetest: ${bridgetest.address}`)

    */
    let homeBridgeTest = new Contract(home_bridgetest, BridgeTest.abi, wallet)
    let foreignBridgeTest = new Contract(foreign_bridgetest, BridgeTest.abi, wallet)
    let homeAmb = new Contract(home_amb, HomeAMB.abi, wallet)
    let foreignAmb = new Contract(foreign_amb, ForeignAMB.abi, wallet)
//    let tx = await homeAmb.requireToPassMessage(home_amb,'0x456', 6000000)

//encode fn call
    let data = foreignBridgeTest.interface.functions.foo.encode([123])
    console.log(`data: ${JSON.stringify(data)}`)
    
    //pass across bridge:
    let tx = await foreignAmb.requireToPassMessage(home_bridgetest, data, 2000000).catch((err) => {console.log(err)})
//    let tx = await homeAmb.requireToPassMessage(foreign_bridgetest, data, 6000000).catch((err) => {console.log(err)})

    console.log(`tx: ${JSON.stringify(tx)}`)
    await tx.wait()
    
}
start()

