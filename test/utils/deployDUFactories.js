const {
    ContractFactory,
} = require("ethers")

const log = require("debug")("Streamr:du:test:deploy")

const DataUnionMainnet = require("../../build/contracts/DataUnionMainnet.json")
const DataUnionSidechain = require("../../build/contracts/DataUnionSidechain.json")
const DataUnionFactorySidechain = require("../../build/contracts/DataUnionFactorySidechain.json")
const DataUnionFactoryMainnet = require("../../build/contracts/DataUnionFactoryMainnet.json")

// TODO: these should also go into the .env file?
const home_erc_mediator = "0x6cCdd5d866ea766f6DF5965aA98DeCCD629ff222"
const foreign_erc_mediator = "0x3AE0ad89b0e094fD09428589849C161f0F7f4E6A"
let templateSidechain

/**
 * Deploy template DataUnion contract as well as factory to sidechain
 * @param wallet {Wallet} sidechain wallet that is used in deployment
 * @returns {Promise<Contract>} DataUnionFactorySidechain contract
 */
async function deployDataUnionFactorySidechain(wallet) {
    log(`Deploying template DU sidechain contract from ${wallet.address}`)
    const templateDeployer = new ContractFactory(DataUnionSidechain.abi, DataUnionSidechain.bytecode, wallet)
    const templateTx = await templateDeployer.deploy({ gasLimit: 6000000 })
    templateSidechain = await templateTx.deployed()
    log(`Side-chain template DU: ${templateSidechain.address}`)

    // constructor(address _token_mediator, address _data_union_sidechain_template)
    log(`Deploying sidechain DU factory contract from ${wallet.address}`)
    const factoryDeployer = new ContractFactory(DataUnionFactorySidechain.abi, DataUnionFactorySidechain.bytecode, wallet)
    const factoryTx = await factoryDeployer.deploy(
        home_erc_mediator,
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

async function deployDataUnionFactoryMainnet(wallet, sidechainTemplateAddress, sidechainFactoryAddress) {
    log(`Deploying template DU mainnet contract from ${wallet.address}`)
    const templateDeployer = new ContractFactory(
        DataUnionMainnet.abi,
        DataUnionMainnet.bytecode,
        wallet
    )
    const templateTx = await templateDeployer.deploy({ gasLimit: 6000000 })
    const templateDU = await templateTx.deployed()
    log(`Mainnet template DU: ${templateDU.address}`)

    // constructor(address _token_mediator, address _data_union_mainnet_template, address _data_union_sidechain_template, address _data_union_sidechain_factory, uint256 _sidechain_maxgas)
    log(`Deploying DU mainnet factory contract from ${wallet.address}`)
    const factoryDeployer = new ContractFactory(
        DataUnionFactoryMainnet.abi,
        DataUnionFactoryMainnet.bytecode,
        wallet
    )
    const factoryTx = await factoryDeployer.deploy(
        foreign_erc_mediator,
        templateDU.address,
        sidechainTemplateAddress,
        sidechainFactoryAddress,
        2000000,
        { gasLimit: 6000000 }
    )
    return factoryTx.deployed()
}

module.exports = {
    deployDataUnionFactorySidechain,
    deployDataUnionFactoryMainnet,
    getTemplateSidechain,
}
