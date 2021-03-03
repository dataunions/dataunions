const {
    Contract,
    Wallet,
    ContractFactory,
} = require("ethers")

const log = require("debug")("Streamr:du:libDU")
const until = require("./await-until")


const DataUnionMainnet = require("../build/contracts/DataUnionMainnet.json")
const DataUnionSidechain = require("../build/contracts/DataUnionSidechain.json")
const DataUnionFactorySidechain = require("../build/contracts/DataUnionFactorySidechain.json")
const DataUnionFactoryMainnet = require("../build/contracts/DataUnionFactoryMainnet.json")
const SidechainMigrationManager = require("../build/contracts/SidechainMigrationManager.json")
const MainnetMigrationManager = require("../build/contracts/MainnetMigrationManager.json")

//defaults are the addresses from docker setup
const home_erc_mediator = process.env.HOME_ERC677_MEDIATOR || "0xedD2aa644a6843F2e5133Fe3d6BD3F4080d97D9F"
const foreign_erc_mediator = process.env.FOREIGN_ERC677_MEDIATOR || "0xedD2aa644a6843F2e5133Fe3d6BD3F4080d97D9F"
const foreign_erc20 = process.env.FOREIGN_ERC20 || "0xbAA81A0179015bE47Ad439566374F2Bae098686F"
const home_erc677 = process.env.HOME_ERC677 || "0x73Be21733CC5D08e1a14Ea9a399fb27DB3BEf8fF"
let templateSidechain
const zeroAddress = "0x0000000000000000000000000000000000000000"

async function deployMainnetMigrationManager(wallet) {
    const migrationMgrDeployer = new ContractFactory(
        MainnetMigrationManager.abi,
        MainnetMigrationManager.bytecode,
        wallet
    )
    var tx = await migrationMgrDeployer.deploy(foreign_erc20, foreign_erc_mediator)
    const migrationManager = await tx.deployed()
    log(`Mainnet migrationManager: ${migrationManager.address}`)
    return migrationManager;
}

async function deploySidechainMigrationManager(wallet) {
    const migrationMgrDeployer = new ContractFactory(
        SidechainMigrationManager.abi,
        SidechainMigrationManager.bytecode,
        wallet
    )
    var tx = await migrationMgrDeployer.deploy(home_erc677, zeroAddress, home_erc_mediator)
    const migrationManager = await tx.deployed()
    log(`Sidechain migrationManager: ${migrationManager.address}`)
    return migrationManager
}

/**
 * Deploy template DataUnion contract as well as factory to sidechain
 * @param wallet {Wallet} sidechain wallet that is used in deployment
 * @returns {Promise<Contract>} DataUnionFactorySidechain contract
 */
async function deployDataUnionFactorySidechain(wallet, migrationMgrAddress = null) {
    log(`Deploying template DU sidechain contract from ${wallet.address}`)
    const templateDeployer = new ContractFactory(DataUnionSidechain.abi, DataUnionSidechain.bytecode, wallet)
    const templateTx = await templateDeployer.deploy({ gasLimit: 6000000 })
    templateSidechain = await templateTx.deployed()
    log(`Side-chain template DU: ${templateSidechain.address}`)

    if (migrationMgrAddress == null) {
        const migrationManager = await deploySidechainMigrationManager(wallet)
        migrationMgrAddress = migrationManager.address
    }

    // constructor(address _token_mediator, address _data_union_sidechain_template)
    log(`Deploying sidechain DU factory contract from ${wallet.address}`)
    const factoryDeployer = new ContractFactory(DataUnionFactorySidechain.abi, DataUnionFactorySidechain.bytecode, wallet)
    const factoryTx = await factoryDeployer.deploy(
        migrationMgrAddress,
        templateSidechain.address,
        { gasLimit: 6000000 }
    )
    return factoryTx.deployed()
}

function getTemplateSidechain() {
    if (!templateSidechain) {
        throw new Error("deployDataUnionFactorySidechain must be called (and awaited) first")
    }
    return templateSidechain
}

async function deployDataUnionFactoryMainnet(wallet, sidechainTemplateAddress, sidechainFactoryAddress, migrationMgrAddress = null) {
    log(`Deploying template DU mainnet contract from ${wallet.address}`)
    const templateDeployer = new ContractFactory(
        DataUnionMainnet.abi,
        DataUnionMainnet.bytecode,
        wallet
    )
    const templateTx = await templateDeployer.deploy({ gasLimit: 6000000 })
    const templateDU = await templateTx.deployed()
    log(`Mainnet template DU: ${templateDU.address}`)

    if (migrationMgrAddress == null) {
        const migrationManager = await deployMainnetMigrationManager(wallet)
        migrationMgrAddress = migrationManager.address
    }

    // constructor(address _token_mediator, address _data_union_mainnet_template, address _data_union_sidechain_template, address _data_union_sidechain_factory, uint256 _sidechain_maxgas)
    log(`Deploying DU mainnet factory contract from ${wallet.address}`)
    const factoryDeployer = new ContractFactory(
        DataUnionFactoryMainnet.abi,
        DataUnionFactoryMainnet.bytecode,
        wallet
    )
    const factoryTx = await factoryDeployer.deploy(
        migrationMgrAddress,
        templateDU.address,
        sidechainTemplateAddress,
        sidechainFactoryAddress,
        2000000,
        { gasLimit: 6000000 }
    )
    return factoryTx.deployed()
}

/**
 * Tell DataUnionFactoryMainnet to create a new DataUnionMainnet,
 *   which then triggers through AMB the DataUnionFactorySidechain to create a new DataUnionSidechain.
 * DU admin will be the mainnet wallet used for transaction, the wallet that dataUnionFactoryMainnet Contract object was created with
 * If DU already is deployed, just return it instead
 * @param {string} duname unique identifier for the DU
 * @param {Contract} dataUnionFactoryMainnet created with `new Contract(factoryAddress, adminWallet)`
 * @param {Provider} sidechainProvider for watching when the deployment has be registered in sidechain
 * @param {number} bridgeTimeoutMs time that it takes for bridge to cause sidechain community to be deployed
 * @returns {Contract} DataUnionMainnet contract
 */
async function deployDataUnion(duname, adminFee, dataUnionFactoryMainnet, sidechainProvider, bridgeTimeoutMs) {
    const adminWallet = new Wallet(dataUnionFactoryMainnet.signer.privateKey, dataUnionFactoryMainnet.provider)
    const duMainnetAddress = await dataUnionFactoryMainnet.mainnetAddress(adminWallet.address, duname)
    const duSidechainAddress = await dataUnionFactoryMainnet.sidechainAddress(duMainnetAddress)
    log(`Requested deploy of DU ${duname}, mainnet ${duMainnetAddress}, sidechain ${duSidechainAddress}`)
    if (await adminWallet.provider.getCode(duMainnetAddress) !== "0x") {
        log(`DU ${duname} already exists, skipping deployment`)
    } else {
        log(`home_erc_mediator ${home_erc_mediator}`)
        const tx = await dataUnionFactoryMainnet.deployNewDataUnion(
            adminWallet.address,
            adminFee,
            [adminWallet.address],
            duname
        )
        log(`tx ${JSON.stringify(tx)}`)
        const tr = await tx.wait()
        log(`deploy tx receipt ${JSON.stringify(tr)}`)
        log(`Waiting for bridge to process deployment and sidechain DU appearing at ${duSidechainAddress}`)
        await until(async () => await sidechainProvider.getCode(duSidechainAddress) !== "0x", bridgeTimeoutMs)
    }

    return new Contract(
        duMainnetAddress,
        DataUnionMainnet.abi,
        adminWallet
    )
}

/**
 * Returns [homeDU, foreignDU] contracts for a given mainnet_address
 * @param {string} mainnet_address 
 */
async function getContracts(mainnet_address, wallet_mainnet, wallet_sidechain) {
    const foreignDU = new Contract(mainnet_address, DataUnionMainnet.abi, wallet_mainnet)
    let sidechain_address = await foreignDU.sidechainAddress()
    const homeDU = new Contract(sidechain_address, DataUnionSidechain.abi, wallet_sidechain)
    return [homeDU, foreignDU]
}

module.exports = {
    deployDataUnionFactorySidechain,
    deployDataUnionFactoryMainnet,
    getTemplateSidechain,
    deployDataUnion,
    getContracts,
    deploySidechainMigrationManager,
    deployMainnetMigrationManager
}
