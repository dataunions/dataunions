import { log, BigInt } from '@graphprotocol/graph-ts'

import { DUCreated } from '../generated/DataUnionFactory/DataUnionFactory'
import { DataUnion as DataUnionDatabaseObject } from '../generated/schema'
import { DataUnion } from '../generated/templates'

export function handleDUCreated(event: DUCreated): void {
    let duAddress = event.params.du
    log.warning('handleDUCreated: address={} blockNumber={}', [duAddress.toHexString(), event.block.number.toString()])

    let dataUnion = new DataUnionDatabaseObject(duAddress.toHexString())
    dataUnion.memberCount = 0
    dataUnion.revenueWei = BigInt.zero()
    dataUnion.creationDate = event.block.timestamp
    dataUnion.save()

    // Instantiate a template: start listening to the new DU contract, trigger src/dataunion.ts on events
    DataUnion.create(duAddress)
}
