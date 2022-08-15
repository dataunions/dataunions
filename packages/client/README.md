<h1 align="left">
  DataUnion Client
</h1>

> ⚠️  The code examples in this section are not up to date.

The Data Union framework is a data crowdsourcing and crowdselling solution. Working in tandem with the Streamr Network and Ethereum, the framework powers applications that enable people to earn by sharing valuable data. You can [read more about it here](https://dataunions.network/docs/data-unions/intro-to-data-unions)

#### Basic use

Start by obtaining a DataUnionClient object:

```js
import { DataUnionClient } from '@dataunions/client'
const DU = new DataUnionClient(clientOptions)
```

_TODO: document `clientOptions`_

To deploy a new DataUnion with default [deployment options](#deployment-options):
```js
const dataUnion = await DU.deployDataUnion()
```

To get an existing (previously deployed) `DataUnion` instance:
```js
const dataUnion = await DU.getDataUnion('0x12345...')
```


#### Admin Functions

Admin functions require xDai tokens on the xDai network. To get xDai you can either use a [faucet](https://www.xdaichain.com/for-users/get-xdai-tokens/xdai-faucet) or you can reach out on the [Streamr Discord #dev channel](https://discord.gg/gZAm8P7hK8).

Adding members using admin functions is not at feature parity with the member function `join`. The newly added member will not be granted publish permissions to the streams inside the Data Union. This will need to be done manually using the StreamrClient, see `StreamrClient.grantPermissions()`. Similarly, after removing a member using the admin function `removeMembers`, the publish permissions will need to be removed in a secondary step using `StreamrClient.revokePermissions()`.

Adding members:
```js
const receipt = await dataUnion.addMembers([
    '0x11111...',
    '0x22222...',
    '0x33333...',
])
```
Removing members:
```js
const receipt = await dataUnion.removeMembers([
    '0x11111...',
    '0x22222...',
    '0x33333...',
])
```

Checking if an address belongs to the Data Union:
```js
const isMember = await dataUnion.isMember('0x12345...')
```

Send all withdrawable earnings to the member's address:
```js
const receipt = await dataUnion.withdrawAllToMember('0x12345...')
```
Send all withdrawable earnings to the address signed off by the member:
```js
const recipientAddress = '0x22222...'

const signature = await dataUnion.signWithdrawAllTo(recipientAddress)
const receipt = await dataUnion.withdrawAllToSigned(
    '0x11111...', // member address
    recipientAddress,
    signature
)
```
Send only some of the withdrawable earnings to the address signed off by the member
```js
const oneEth = "1000000000000000000" // amounts in wei
const signature = await dataUnion.signWithdrawAmountTo(recipientAddress, oneEth)
const receipt = await dataUnion.withdrawAmountToSigned(
    '0x12345...', // member address
    recipientAddress,
    oneEth,
    signature
)
```

Setting a new admin fee:
```js
// Any number between 0 and 1, inclusive
const receipt = await dataUnion.setAdminFee(0.4)
```

If the Data Union is set up to use the [default join server](https://github.com/dataunions/data-unions/tree/main/packages/default-join-server) then members can join the Data Union by giving a correct secret.

Admin can add secrets that allow anyone to join, as well as revoke those secrets, using the following functions:
```js
await dataUnion.createSecret() // returns the newly created secret
await dataUnion.createSecret('user XYZ') // admin can also give the secret a more human-readable name
await dataUnion.deleteSecret(secret) // secret as returned by createSecret
await dataUnion.listSecrets() // in case you forgot ;)
```

The `dataUnion.createSecret()` response will look like the following:
```js
{
	"secret": "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf",
	"dataUnion": "0x12345",
	"chain": "polygon",
	"name": "A human-readable label for the new secret"
}
```

The member can then join using that same response object, or simply an object with the correct field "secret":
```js
await dataUnion.join(secretResponse)
await dataUnion.join({ secret: "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf" })
```

#### Query functions
These are available for everyone and anyone, to query publicly available info from a Data Union.

Get Data Union's statistics:
```js
const stats = await dataUnion.getStats()
```
Get a member's stats:
```js
const memberStats = await dataUnion.getMemberStats('0x12345...')
```
Get the withdrawable DATA tokens in the DU for a member:
```js
// Returns a BigNumber
const balance = await dataUnion.getWithdrawableEarnings('0x12345...')
```
Getting the set admin fee:
```js
const adminFee = await dataUnion.getAdminFee()
```
Getting admin's address:
```js
const adminAddress = await dataUnion.getAdminAddress()
```

Getting the Data Union's version:
```js
const version = await dataUnion.getVersion()
// Can be 0, 1 or 2
// 0 if the contract is not a data union
```

#### Withdraw options

The functions `withdrawAll`, `withdrawAllTo`, `withdrawAllToMember`, `withdrawAllToSigned`, `withdrawAmountToSigned` all can take an extra "options" argument. It's an object that can contain the following parameters. The provided values are the default ones, used when not specified or when the options parameter is not provided:
```js
const receipt = await dataUnion.withdrawAll(
    ...,
    {
        sendToMainnet: true, // Whether to send the withdrawn DATA tokens to mainnet address (or sidechain address)
        payForTransport: true, //Whether to pay for the withdraw transaction signature transport to mainnet over the bridge
        waitUntilTransportIsComplete: true, // Whether to wait until the withdrawn DATA tokens are visible in mainnet
        pollingIntervalMs: 1000, // How often requests are sent to find out if the withdraw has completed, in ms
        retryTimeoutMs: 60000, // When to give up when waiting for the withdraw to complete, in ms
        gasPrice: /*Network Estimate*/ // Ethereum Mainnet transaction gas price to use when transporting tokens over the bridge
    }
)
```

These withdraw transactions are sent to the sidechain, so gas price shouldn't be manually set (fees will hopefully stay very low),
but a little bit of [sidechain native token](https://www.xdaichain.com/for-users/get-xdai-tokens) is nonetheless required.

The return values from the withdraw functions also depend on the options.

If `sendToMainnet: false`, other options don't apply at all, and **sidechain transaction receipt** is returned as soon as the withdraw transaction is done. This should be fairly quick in the sidechain.

The use cases corresponding to the different combinations of the boolean flags:

| `transport` | `wait`  | Returns | Effect |
| :---------- | :------ | :------ | :----- |
| `true`      | `true`  | Transaction receipt | *(default)* Self-service bridge to mainnet, client pays for mainnet gas |
| `true`      | `false` | Transaction receipt | Self-service bridge to mainnet (but **skip** the wait that double-checks the withdraw succeeded and tokens arrived to destination) |
| `false`     | `true`  | `null`              | Someone else pays for the mainnet gas automatically, e.g. the bridge operator (in this case the transaction receipt can't be returned) |
| `false`     | `false` | AMB message hash    | Someone else pays for the mainnet gas, but we need to give them the message hash first |

#### Deployment options

`deployDataUnion` can take an options object as the argument. It's an object that can contain the following parameters. All shown values are the defaults for each property:
```js
const ownerAddress = await dataunions.getAddress()

const dataUnion = await dataunions.deployDataUnion({
    owner: ownerAddress, // Owner / admin of the newly created Data Union
    joinPartsAgent: [ownerAddress], // Able to add and remove members to/from the Data Union
    dataUnionName: /* Generated if not provided */, // NOT stored anywhere, only used for address derivation
    adminFee: 0, // Must be between 0...1
    sidechainPollingIntervalMs: 1000, //How often requests are sent to find out if the deployment has completed
    sidechainRetryTimeoutMs: 60000, // When to give up when waiting for the deployment to complete
    confirmations: 1, // Blocks to wait after Data Union mainnet contract deployment to consider it final
    gasPrice: /*Network Estimate*/ // Ethereum Mainnet gas price to use when deploying the Data Union mainnet contract
})
```

Streamr Core is added as a `joinPartAgent` by default so that joining with secret works using the member function `join`. If you don't plan to use `join` for "self-service joining", you can leave out Streamr Core agent by calling `deployDataUnion` e.g. with your own address as the sole joinPartAgent:
```js
const dataUnion = await DU.deployDataUnion({
    joinPartAgents: [ownerAddress],
    adminFee,
})
```

`dataUnionName` option exists purely for the purpose of predicting the addresses of Data Unions not yet deployed. Data Union deployment uses the [CREATE2 opcode](https://eips.ethereum.org/EIPS/eip-1014) which means a Data Union deployed by a particular address with particular "name" will have a predictable address.

### Utility functions
In order to retrieve the client's address an async call must me made to `dataunions.getAddress`
```js
const address = await dataunions.getAddress()
```

