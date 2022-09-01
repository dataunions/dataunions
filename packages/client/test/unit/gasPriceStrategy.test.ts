import { parseEther, parseUnits } from '@ethersproject/units'
import type { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'
import type { DataUnionClientConfig} from '../../src/Config'
import { DATAUNION_CLIENT_DEFAULTS } from '../../src/Config'

import { deployContracts, getWallets } from './setup'

describe("Gas price strategy", () => {
    let dao: Wallet
    let member: Wallet
    // let token: DATAv2
    let clientOptions: Partial<DataUnionClientConfig>
    beforeAll(async () => {
        [
            dao,
            member,
        ] = getWallets()
        const {
            token,
            dataUnionFactory,
            dataUnionTemplate,
            ethereumUrl
        } = await deployContracts(dao)

        clientOptions = {
            auth: { privateKey: member.privateKey },
            tokenAddress: token.address,
            dataUnion: {
                factoryAddress: dataUnionFactory.address,
                templateAddress: dataUnionTemplate.address,
            },
            network: { rpcs: [{ url: ethereumUrl, timeout: 30 * 1000 }] }
        }
    })

    it("default strategy using the default options", async () => {
        const client = new DataUnionClient({
            auth: {
                privateKey: member.privateKey
            }
        })
        const calculated = client.gasPriceStrategy!(parseUnits("100", "gwei"))
        const expected = parseUnits("110", "gwei")
        expect(calculated.toString()).toEqual(expected.toString())
    })

    it("correctly modifies the gas price via overrides", async () => {
        const client = new DataUnionClient({...clientOptions, chain: DATAUNION_CLIENT_DEFAULTS.chain})

        const { maxFeePerGas: defaultGasPrice } = await client.wallet.provider!.getFeeData()
        const expectedGasPrice = client.gasPriceStrategy!(defaultGasPrice!)

        // see e.g. DataUnionAPI.ts:deployDataUnion()
        const ethersOverrides = client.getOverrides()
        const duFactory = await client.getFactory()
        const tx = await duFactory.deployNewDataUnion(
            member.address,
            parseEther("0"),
            [],
            "",
            ethersOverrides
        )

        expect(tx.maxFeePerGas).toBeTruthy()
        expect(tx.maxFeePerGas!.toString()).toEqual(expectedGasPrice.toString())
    })
})