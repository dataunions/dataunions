const { Contract, Wallet } = require("ethers")

// just for types
//const { Provider } = require("ethers/providers")

const log = require("debug")("Streamr:du:deploy")

const until = require("./await-until")

//const DataUnionFactoryMainnet = require("../build/contracts/DataUnionFactoryMainnet.json")
const DataUnionMainnet = require("../build/contracts/DataUnionMainnet.json")

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
async function deployDataUnion(duname, dataUnionFactoryMainnet, sidechainProvider, bridgeTimeoutMs) {
    const adminWallet = new Wallet(dataUnionFactoryMainnet.signer.privateKey, dataUnionFactoryMainnet.provider)
    const duMainnetAddress = await dataUnionFactoryMainnet.mainnetAddress(adminWallet.address, duname)
    const duSidechainAddress = await dataUnionFactoryMainnet.sidechainAddress(duMainnetAddress)
    log(`Requested deploy of DU ${duname}, mainnet ${duMainnetAddress}, sidechain ${duSidechainAddress}`)

    if (await adminWallet.provider.getCode(duMainnetAddress) !== "0x") {
        log(`DU ${duname} already exists, skipping deployment`)
    } else {
        const tx = await dataUnionFactoryMainnet.deployNewDataUnion(
            adminWallet.address,
            0,
            [adminWallet.address],
            duname
        )
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

module.exports = deployDataUnion
