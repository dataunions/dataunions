// adapted from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/v1.12.0/test/ownership/Claimable.test.js

const { assertFails } = require("../utils/web3Assert")

const Ownable = artifacts.require("Ownable")

contract("Ownable", function (accounts) {
    let ownable

    beforeEach(async function () {
        ownable = await Ownable.new()
    })

    it("should have an owner", async function () {
        const owner = await ownable.owner()
        assert(owner !== 0)
    })

    it("changes pendingOwner after transfer", async function () {
        const newOwner = accounts[1]
        await ownable.transferOwnership(newOwner)
        const pendingOwner = await ownable.pendingOwner()

        assert(pendingOwner === newOwner)
    })

    it("should prevent to claimOwnership from no pendingOwner", async function () {
        await assertFails(ownable.claimOwnership({ from: accounts[2] }), "error_onlyPendingOwner")
    })

    it("should prevent non-owners from transfering", async function () {
        const other = accounts[2]
        const owner = await ownable.owner.call()

        assert(owner !== other)
        await assertFails(ownable.transferOwnership(other, { from: other }), "error_onlyOwner")
    })

    describe("after initiating a transfer", function () {
        let newOwner

        beforeEach(async function () {
            newOwner = accounts[1]
            await ownable.transferOwnership(newOwner)
        })

        it("changes allow pending owner to claim ownership", async function () {
            await ownable.claimOwnership({ from: newOwner })
            const owner = await ownable.owner()

            assert(owner === newOwner)
        })
    })
})