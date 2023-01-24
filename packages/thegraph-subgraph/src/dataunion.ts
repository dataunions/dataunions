import { log, Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'

import { DataUnion, DataUnionStatsBucket, Member, RevenueEvent } from '../generated/schema'
import {
    MemberJoined,
    MemberParted,
    OwnershipTransferred,
    RevenueReceived,
    MemberWeightChanged,
} from '../generated/templates/DataUnion/DataUnionTemplate'

///////////////////////////////////////////////////////////////
// HANDLERS: see subgraph.*.yaml for the events that are handled
///////////////////////////////////////////////////////////////

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
    let dataUnion = getDataUnion(event.address)
    dataUnion.owner = event.params.newOwner.toHexString()
    dataUnion.save()
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
    member.weight = BigDecimal.fromString('1')
    member.save()

    updateDataUnion(duAddress, event.block.timestamp, 1)
}

export function handleMemberParted(event: MemberParted): void {
    let duAddress = event.address
    let memberAddress = event.params.member
    log.warning('handleMemberParted: member={} duAddress={}', [memberAddress.toHexString(), duAddress.toHexString()])

    let member = getMember(memberAddress, duAddress)
    member.status = 'INACTIVE'
    member.save()

    updateDataUnion(duAddress, event.block.timestamp, -1)
}

export function handleRevenueReceived(event: RevenueReceived): void {
    let duAddress = event.address
    let amount = event.params.amount
    log.warning('handleRevenueReceived: duAddress={} amount={}', [duAddress.toHexString(), amount.toString()])

    updateDataUnion(duAddress, event.block.timestamp, 0, BigDecimal.zero(), amount)

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

export function handleMemberWeightChanged(event: MemberWeightChanged): void {
    let duAddress = event.address
    let memberAddress = event.params.member
    let oldWeightWei = event.params.oldWeight
    let weightWei = event.params.newWeight
    let weight = weightWei.toBigDecimal().div(BigDecimal.fromString('1000000000000000000'))
    let weightChange = weightWei.minus(oldWeightWei).toBigDecimal().div(BigDecimal.fromString('1000000000000000000'))
    log.warning('handleMemberWeightChanged: member={} duAddress={} weight={} (+ {})', [
        memberAddress.toHexString(), duAddress.toHexString(), weight.toString(), weightChange.toString()
    ])

    let member = getMember(memberAddress, duAddress)
    member.weight = weight
    member.save()

    updateDataUnion(duAddress, event.block.timestamp, 0, weightChange)
}

function updateDataUnion(
    duAddress: Address,
    timestamp: BigInt,
    memberCountChange: i32,
    totalWeightChange: BigDecimal = BigDecimal.zero(),
    revenueChangeWei: BigInt = BigInt.zero()
): void {
    log.warning('updateDataUnion: duAddress={} timestamp={}', [duAddress.toHexString(), timestamp.toString()])

    // buckets must be done first so that *AtStart values are correct for newly created buckets
    let hourBucket = getBucket('HOUR', timestamp, duAddress)
    hourBucket.memberCountChange += memberCountChange
    hourBucket.revenueChangeWei += revenueChangeWei
    hourBucket.totalWeightChange += totalWeightChange
    hourBucket.save()

    let dayBucket = getBucket('DAY', timestamp, duAddress)
    dayBucket.memberCountChange += memberCountChange
    dayBucket.revenueChangeWei += revenueChangeWei
    dayBucket.totalWeightChange += totalWeightChange
    dayBucket.save()

    let dataUnion = getDataUnion(duAddress)
    dataUnion.memberCount += memberCountChange
    dataUnion.revenueWei += revenueChangeWei
    dataUnion.totalWeight += totalWeightChange
    dataUnion.save()
}

///////////////////////////////////////////////////////////////
// GETTERS: load an existing object or create a new one
///////////////////////////////////////////////////////////////

function getDataUnion(duAddress: Address): DataUnion {
    let dataUnion = DataUnion.load(duAddress.toHexString())
    if (dataUnion == null) {
        // this should never happen because in factory.ts we create a DataUnion object for every new DataUnion template instantiation
        //   the functions in this file can only be called after the template is instantiated
        // if you get this error, it means either that the DB is in bad state, or code has been changed to instantiate
        //   DataUnion templates without creating the corresponding DataUnion DB objects
        throw new Error('getDataUnion: DataUnion database object was not found, address=' + duAddress.toHexString())
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

function getBucket(length: string, timestamp: BigInt, duAddress: Address): DataUnionStatsBucket {
    let bucketSeconds: BigInt
    if (length === 'HOUR') {
        bucketSeconds = BigInt.fromI32(60 * 60)
    } else if (length === 'DAY') {
        bucketSeconds = BigInt.fromI32(24 * 60 * 60)
    } else {
        log.error('getBucketLength: unknown length={}', [length])
        length = 'HOUR'
        bucketSeconds = BigInt.fromI32(60 * 60)
    }

    let bucketStartDate = timestamp.minus(timestamp.mod(bucketSeconds))
    let bucketId = duAddress.toHexString() + '-' + length + '-' + bucketStartDate.toString()
    let bucket = DataUnionStatsBucket.load(bucketId)

    // Create a new bucket, get starting values from DataUnion
    if (bucket == null) {
        bucket = new DataUnionStatsBucket(bucketId)
        bucket.type = length
        bucket.dataUnion = duAddress.toHexString()
        bucket.startDate = bucketStartDate
        bucket.endDate = bucketStartDate.plus(bucketSeconds)

        let dataUnion = getDataUnion(duAddress)
        bucket.memberCountAtStart = dataUnion.memberCount
        bucket.revenueAtStartWei = dataUnion.revenueWei
        bucket.totalWeightAtStart = dataUnion.totalWeight

        bucket.memberCountChange = 0
        bucket.revenueChangeWei = BigInt.zero()
        bucket.totalWeightChange = BigDecimal.zero()
    }
    return bucket
}
