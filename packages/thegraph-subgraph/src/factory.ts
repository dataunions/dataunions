import { log, BigInt, Address } from '@graphprotocol/graph-ts'

import { DUCreated } from '../generated/DataUnionFactory/DataUnionFactory'
import { SidechainDUCreated } from '../generated/DataUnionFactorySidechain/DataUnionFactorySidechain'
import { DataUnion as DataUnionDatabaseObject } from '../generated/schema'
import { DataUnion } from '../generated/templates'

// event SidechainDUCreated(address indexed mainnet, address indexed sidenet, address indexed owner, address template);
export function handleDU2Created(event: SidechainDUCreated): void {
    let duAddress = event.params.mainnet
    log.warning('[old] handleDU2Created: address={} blockNumber={}', [duAddress.toHexString(), event.block.number.toString()])
    createDataUnion(duAddress, event.block.timestamp)
}

export function handleDUCreated(event: DUCreated): void {
    let duAddress = event.params.du
    log.warning('handleDUCreated: address={} blockNumber={}', [duAddress.toHexString(), event.block.number.toString()])
    createDataUnion(duAddress, event.block.timestamp)
}

export function createDataUnion(duAddress: Address, creationDate: BigInt): void {
    let dataUnion = new DataUnionDatabaseObject(duAddress.toHexString())
    dataUnion.memberCount = 0
    dataUnion.revenueWei = BigInt.zero()
    dataUnion.creationDate = creationDate
    dataUnion.save()

    // Instantiate a template: start listening to the new DU contract, trigger src/dataunion.ts on events
    DataUnion.create(duAddress)
}
