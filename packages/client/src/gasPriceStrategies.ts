// import { BigNumberish } from "@ethersproject/bignumber"
import type { FeeData, Provider } from "@ethersproject/providers"
import { parseUnits } from "@ethersproject/units"
import fetch from 'node-fetch'

// export type GasPrice = { maxFeePerGas: BigNumberish, maxPriorityFeePerGas: BigNumberish }
// export type GasPriceStrategy = (provider: Provider) => (GasPrice | Promise<GasPrice>)
export type GasPriceStrategy = (provider: Provider) => (Partial<FeeData> | Promise<Partial<FeeData>>)

async function getPolygonGasPrice(provider: Provider): Promise<Partial<FeeData>> {
    try {
        // example response: {
        //   "safeLow":{"maxPriorityFee":30.639746665266667,"maxFee":30.63974668026667},
        //   "standard":{"maxPriorityFee":33.7182337732,"maxFee":33.718233788199996},
        //   "fast":{"maxPriorityFee":46.24675554826667,"maxFee":46.24675556326667},
        //   "estimatedBaseFee":1.5e-8,"blockTime":2,"blockNumber":33293051
        //}
        const response = await fetch("https://gasstation-mainnet.matic.network/v2")
        const fees = await response.json()
        return {
            maxFeePerGas: parseUnits(Math.ceil(fees.standard.maxFee).toString(), "gwei"),
            maxPriorityFeePerGas: parseUnits(Math.ceil(fees.standard.maxPriorityFee).toString(), "gwei"),
        }
    } catch (e) {
        return add10gwei(provider)
    }
}

// async function getPolygonGasPrice2(provider: Provider): Promise<Partial<FeeData>> {
//     try {
//         const networkGasPrice = await provider.getGasPrice()
//         return {
//             maxFeePerGas: networkGasPrice.add('10000000020'),
//             maxPriorityFeePerGas: networkGasPrice.add('10000000000'),
//         }
//     } catch (e) {
//         return getPolygonGasPrice(provider)
//     }
// }

/** Sensible default for working in gnosis chain: add a bit more gas, TODO: how did we end up with this? */
async function add10gwei(provider: Provider): Promise<Partial<FeeData>> {
    const networkGasPrice = await provider.getGasPrice()
    provider.getFeeData
    const gasPrice = networkGasPrice.add('10000000000')
    return { gasPrice }
}

// missing from list means don't give any extra ethers overrides
export const gasPriceStrategies: { [chainName: string]: GasPriceStrategy } = {
    polygon: getPolygonGasPrice,
    gnosis: add10gwei,
}