// first register ens domain on mainnet
// scripts/deploy.js

import { BigNumber, providers } from "ethers"
import { parseEther } from "ethers/lib/utils"
import { DataUnionFactory, DataUnionTemplate } from "../../typechain"

import hhat from "hardhat"

const { ethers } = hhat

const DEFAULTPRIVATEKEY = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
// const DEFAULTPRIVATEKEY = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
type EthereumAddress = string

// addresses localsidechain
const DATAUNIONFACTORYADDRESS = "0x586DA9aa97fF2652f341f05daaf60Ba956A9b5c9"

// const SIDECHAINURL = "http://localhost:8545"
const SIDECHAINURL = "http://localhost:8546"

const sideChainProvider = new providers.JsonRpcProvider(SIDECHAINURL)

const walletSidechain = new ethers.Wallet(DEFAULTPRIVATEKEY, sideChainProvider)
let duFactoryContract: DataUnionFactory
let tokenfromfac: EthereumAddress

const connectToAllContracts = async () => {
    const dataUnionFactoryFactory = await ethers.getContractFactory("DataUnionFactory", walletSidechain)
    const dataUnionFactory = await dataUnionFactoryFactory.attach(DATAUNIONFACTORYADDRESS)
    duFactoryContract = await dataUnionFactory.deployed() as DataUnionFactory
    console.log("factory connected " + duFactoryContract.address)
    tokenfromfac = await duFactoryContract.defaultToken()
    console.log("token from factory " + tokenfromfac)
}

const createDU = async () => {
    const sendtx = await walletSidechain.sendTransaction({
        to: duFactoryContract.address,
        value: parseEther("2"),
    })
    await sendtx.wait()
    console.log("sent 2 ether to factory")

    const args: [EthereumAddress, BigNumber, BigNumber, EthereumAddress, EthereumAddress[]] = [
        // creator.address,
        walletSidechain.address,
        parseEther("0"),
        parseEther("0"),
        // others[0].address,
        walletSidechain.address,
        // agents.map(a => a.address),
        [ walletSidechain.address ]
    ]

    const tx = await duFactoryContract.deployNewDataUnion(...args)
    const tr = await tx.wait()
    const [createdEvent] = tr?.events?.filter((evt: any) => evt?.event === "DUCreated") ?? []
    if (!createdEvent || !createdEvent.args || !createdEvent.args.length) {
        throw new Error("Missing DUCreated event")
    }
    const [newDuAddress] = createdEvent?.args
    console.log(newDuAddress)
    // const bytecode = await sideChainProvider.getCode(newDuAddress)
    // console.log("bytecode " + bytecode)
    const dataUnionF = await ethers.getContractFactory("DataUnionTemplate", walletSidechain)
    const dataUnion = await dataUnionF.attach(newDuAddress)
    const du = await dataUnion.deployed() as DataUnionTemplate
    console.log("du connected " + du.address)
    // const inittx = await du.initialize(args[0], tokenfromfac, args[4], args[1], args[1], args[1], args[0])
    // await inittx.wait()
    // console.log("initialized")
}


async function main() {
    await connectToAllContracts()
    await createDU()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

