import { Wallet } from "@ethersproject/wallet"
import { sign, verify } from "../../src/signing"

const validRequest = {
    address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
    request: '{"foo":"bar"}',
    timestamp: '2022-07-01T00:00:00.000Z',
    signature: '0xefde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a0'
             + '2c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
}

const badSignature = {
    address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
    request: '{"foo":"bar"}',
    timestamp: '2022-07-01T00:00:00.000Z',
    signature: '0x0fde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a0'
             + '2c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
}

const changedData = {
    address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
    request: '{"foo":"xyz"}',
    timestamp: '2022-07-01T00:00:00.000Z',
    signature: '0x0fde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a0'
             + '2c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b'
}

const futureRequest = {
    address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
    request: '{"foo":"bar"}',
    timestamp: '2022-07-01T00:06:00.000Z',
    signature: '0x458a8940e4b047f773f6e3cf328a71f5bebf144b0ff2d7373a34ffea239ddeb4'
             + '631e9b57cbf71dc04826dce04e7e07952f95e7a7b2d1a5f9b9fdfec3ba5e93cc1b'
}

const oldRequest = {
    address: '0xf79d101E1243cbDdE02d0F49E776fA65de0122ed',
    request: '{"foo":"bar"}',
    timestamp: '2022-06-30T23:54:00.000Z',
    signature: '0xa47594596ee33fc034e69af17828c102cc546c92c8598c002f3fbbb108aabbcc'
             + '5dd3a041e35ceeb15510ebd5d25401d68963bc19ff248427852b24f45d88494c1c'
}

describe('Join server request signing', () => {

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2022-07-01T00:00:00Z').getTime())
    })

    it('produces a valid SignedRequest (default timestamp)', async () => {
        const wallet = Wallet.createRandom()
        const request = { test: "data" }
        const signedRequest = await sign(request, wallet)
        const payload = verify(signedRequest)
        expect(payload).toEqual(request)
    })

    it('produces the correct SignedRequest (custom timestamp)', async () => {
        const wallet = new Wallet("0x0000000000000000000000000000000000000000000000000000000000000001")
        const request = { test: "data" }
        const signedRequest = await sign(request, wallet, new Date("2022-07-01T00:00:00.000Z"))
        expect(signedRequest).toEqual({
            address: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
            request: '{"test":"data"}',
            signature: "0x7d925a4a3327a9499b86993d32a3a9ca9f081293b06c56816c565e6bc76da756"
                     + "465e3c17c91c977d8bab98ed70c8e5abdd008d4cffead5091517227429a38e711c",
            timestamp: "2022-07-01T00:00:00.000Z",
        })
    })

    describe('verifier', () => {
        it('accepts valid requests and returns the request payload (+)', async () => {
            expect(verify(validRequest)).toEqual({foo: 'bar'})
        })

        it('rejects requests with invalid signature (-)', async () => {
            expect(() => verify(badSignature)).toThrow('Invalid signature!')
        })

        it('rejects requests with tampered data (-)', async () => {
            expect(() => verify(changedData)).toThrow('Invalid signature!')
        })

        it('rejects requests in the future (-)', async () => {
            expect(() => verify(futureRequest)).toThrow('Timestamp rejected!')
        })

        it('rejects requests in the past (-)', async () => {
            expect(() => verify(oldRequest)).toThrow('Timestamp rejected!')
        })
    })
})
