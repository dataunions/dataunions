import { Interface } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { parseEther } from '@ethersproject/units'
import { Wallet } from '@ethersproject/wallet'

import { DataUnionClient } from '../../src/DataUnionClient'

const { log } = console

const provider = new JsonRpcProvider("https://polygon-rpc.com/")
const wallet = new Wallet(process.env.PRIVATE_KEY || "missing PRIVATE_KEY env variable", provider)
// provider.on("debug", (info) => {
//     if (info?.action === "response" && info?.request?.method === "eth_estimateGas") {
//         log("eth_estimateGas %o %s", info.request, info.response)
//     } else if (info?.error) {
//         const { code, error: { message, transaction } } = info.error
//         log("%s %s %o", code, message, transaction)
//     } else {
//         log("%s %o %o", info?.action, info?.request?.method, info?.response)
//     }
// })

// Logger.setLogLevel(Logger.levels.DEBUG)

describe('Client on Polygon on default settings', () => {
    it.skip('Can deploy DUs', async () => {
        const client = new DataUnionClient({
            auth: { privateKey: wallet.privateKey }
        })
        const d = await client.deployDataUnion()
        log("deployDataUnion -> %s", d.getAddress())
    })
    const duAddress = "0x1165652fe95513a07d3c9688b5521961598ffe91" // created using the above test case

    it.skip('Can add member', async () => {
        const client = new DataUnionClient({
            auth: { privateKey: wallet.privateKey }
        })
        const du = await client.getDataUnion(duAddress)
        const tr = await du.addMembers([memberAddress])
        log("addMembers -> %o", tr.events?.map((e) => e.event))
    })
    const memberAddress = "0xa2aE6C7a1C85a8f5Bb948a30C0AD2dB95e09057C" // added using the above test case

    it('Can send tokens', async () => {
        const client = new DataUnionClient({
            auth: { privateKey: wallet.privateKey }
        })
        const du = await client.getDataUnion(duAddress)
        const tr = await du.transferToMemberInContract(memberAddress, parseEther("0.01"))
        log("transferToMemberInContract -> %o", tr.events?.map((e) => e.event))
    })

    it('Fails when not using client (transaction underpriced)', async() => {
        const target = "0xa2aE6C7a1C85a8f5Bb948a30C0AD2dB95e09057C"
        const token = new Contract("0x06078ab1614c94B5101AB9412B06a183D16F191D",
            new Interface(["function transfer(address _to, uint256 _value) public returns (bool success)"]),
            wallet
        )
        expect(token.transfer(target, parseEther("0.01"))).rejects.toThrow(/transaction underpriced/)
    })
})