import { log } from '@graphprotocol/graph-ts'

import { SidechainDUCreated } from '../generated/DataUnionFactorySidechain/DataUnionFactorySidechain'
import { DataUnion } from '../generated/schema'
import { DataUnionSidechain } from '../generated/templates'

export function handleDUCreated(event: SidechainDUCreated): void {
    log.warning('handleDUCreated: sidechainaddress={} blockNumber={}', [event.params.sidenet.toHexString(), event.block.number.toString()])

    let dataunion = new DataUnion(event.params.sidenet.toHexString())
    dataunion.sidechainAddress = event.params.sidenet
    dataunion.mainchainAddress = event.params.mainnet
    dataunion.memberCount = 0
    dataunion.save()

    // Instantiate template
    DataUnionSidechain.create(event.params.sidenet)
}
