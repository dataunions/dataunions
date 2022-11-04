import { log, Address, BigInt } from '@graphprotocol/graph-ts'

import { DataUnion, DataUnionStatsBucket, Member, RevenueEvent } from '../generated/schema'
import {
    MemberJoined,
    MemberParted,
    MetadataChanged,
    OwnershipTransferred,
    RevenueReceived
} from '../generated/templates/DataUnion/DataUnionTemplate'

///////////////////////////////////////////////////////////////
// HANDLERS: see subgraph.*.yaml for the events that are handled
///////////////////////////////////////////////////////////////

export function handleMetadataChanged(event: MetadataChanged): void {
    let dataUnion = getDataUnion(event.address)
    if (dataUnion != null) {
        dataUnion.metadata = event.params.newMetadata
        dataUnion.save()
    }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
    let dataUnion = getDataUnion(event.address)
    if (dataUnion != null) {
        dataUnion.owner = event.params.newOwner.toHexString()
        dataUnion.save()
    }
}

export function handleMemberJoined(event: MemberJoined): void {
    let duAddress = event.address
    let memberAddress = event.params.member
    log.warning('handleMemberJoined: member={} duAddress={}', [memberAddress.toHexString(), duAddress.toHexString()])

    let member = getMember(memberAddress, duAddress)
    member.address = memberAddress.toHexString()
    member.dataUnion = duAddress.toHexString()
    member.joinDate = event.block.timestamp
    member.status = 'ACTIVE'
    member.save()

    updateDataUnionStats(duAddress, event.block.timestamp, 1)
}

export function handleMemberParted(event: MemberParted): void {
    let duAddress = event.address
    let memberAddress = event.params.member
    log.warning('handleMemberParted: member={} duAddress={}', [memberAddress.toHexString(), duAddress.toHexString()])

    let member = getMember(memberAddress, duAddress)
    member.status = 'INACTIVE'
    member.save()

    updateDataUnionStats(duAddress, event.block.timestamp, -1)
}

export function handleRevenueReceived(event: RevenueReceived): void {
    let duAddress = event.address
    let amount = event.params.amount
    log.warning('handleRevenueReceived: duAddress={} amount={}', [duAddress.toHexString(), amount.toString()])

    updateDataUnionStats(duAddress, event.block.timestamp, 0, amount)

    // additionally save the individual events for later querying
    let revenueEvent = new RevenueEvent(
        duAddress.toHexString() + '-' +
        event.block.number.toString() + '-' +
        event.transaction.index.toHexString() + '-' +
        event.transactionLogIndex.toString()
    )
    revenueEvent.dataUnion = duAddress.toHexString()
    revenueEvent.amountWei = amount
    revenueEvent.date = event.block.timestamp
    revenueEvent.save()
}

function updateDataUnionStats(duAddress: Address, timestamp: BigInt, memberCountChange: i32, revenueChangeWei: BigInt = BigInt.zero()): void {
    log.warning('updateDataUnion: duAddress={} timestamp={}', [duAddress.toHexString(), timestamp.toString()])

    // buckets must be done first so that *AtStart values are correct for newly created buckets
    let hourBucket = getBucket('HOUR', timestamp, duAddress)
    hourBucket!.memberCountChange += memberCountChange
    hourBucket!.revenueChangeWei += revenueChangeWei
    hourBucket!.save()

    let dayBucket = getBucket('DAY', timestamp, duAddress)
    dayBucket!.memberCountChange += memberCountChange
    dayBucket!.revenueChangeWei += revenueChangeWei
    dayBucket!.save()

    let dataUnion = getDataUnion(duAddress)
    if (dataUnion != null) {
        dataUnion.memberCount += memberCountChange
        dataUnion.revenueWei += revenueChangeWei
        dataUnion.save()
    }
}

///////////////////////////////////////////////////////////////
// GETTERS: load an existing object or create a new one
///////////////////////////////////////////////////////////////

function getDataUnion(duAddress: Address): DataUnion | null {
    let dataUnion = DataUnion.load(duAddress.toHexString())
    if (dataUnion == null) {
        log.error('getDataUnion: DU was not found, address={}', [duAddress.toHexString()])
    }
    return dataUnion
}

function getMember(memberAddress: Address, duAddress: Address): Member {
    let memberId = memberAddress.toHexString() + '-' + duAddress.toHexString()
    let member = Member.load(memberId)
    if (member == null) {
        member = new Member(memberId)
    }
    return member
}

function getBucket(length: string, timestamp: BigInt, duAddress: Address): DataUnionStatsBucket | null {
    let bucketSeconds: BigInt
    if (length === 'HOUR') {
        bucketSeconds = BigInt.fromI32(60 * 60)
    } else if (length === 'DAY') {
        bucketSeconds = BigInt.fromI32(24 * 60 * 60)
    } else {
        log.error('getBucketLength: unknown length={}', [length])
        return null
    }

    let bucketStartDate = timestamp.minus(timestamp.mod(bucketSeconds))
    let bucketId = duAddress.toHexString() + '-' + length + '-' + bucketStartDate.toString()
    let bucket = DataUnionStatsBucket.load(bucketId)
    if (bucket == null) {
        // Get DataUnion to fetch member count at bucketStartDate
        let memberCount = 0
        let revenueWei = BigInt.zero()
        let dataUnion = getDataUnion(duAddress)
        if (dataUnion != null) {
            memberCount = dataUnion.memberCount
            revenueWei = dataUnion.revenueWei
        }

        // Create new bucket
        bucket = new DataUnionStatsBucket(bucketId)
        bucket.type = length
        bucket.dataUnion = duAddress.toHexString()
        bucket.startDate = bucketStartDate
        bucket.endDate = bucketStartDate.plus(bucketSeconds)
        bucket.memberCountAtStart = memberCount
        bucket.revenueAtStartWei = revenueWei
        bucket.memberCountChange = 0
        bucket.revenueChangeWei = BigInt.zero()
    }
    return bucket
}
