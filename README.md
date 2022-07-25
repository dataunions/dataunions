# data-union-joining-server

This is a gatekeeper HTTP server for requiring Data Union members to fulfil certain requirements in order to join a Data Union. Example use cases are limiting members to users of a certain application by requiring an application secret to be passed along with the join request, or preventing bots by requiring users to complete a CAPTCHA.

The process of joining a Data Union is generally as follows:
- At Data Union creation time, a `joinPartAgent` Ethereum address is configured on the Data Union smart contract. The `joinPartAgent` is able to add members to the Data Union.
- This Data Union join server is configured with the private key for the `joinPartAgent` address.
- When a member wants to join via the Data Union application, a HTTP request is sent to this join server.
- The join server validates the join request (by validating app secret, captcha, or whatever is needed), and then makes a blockchain transaction to add the member to the Data Union.

Data Union builder teams can easily extend the validation logic and run their own join server. Implementing any kind of join request validation logic is possible.

As an alternative to running your own customized join server, the Data Union DAO hosts a **default join server**, which also extends this base package and implements a validation logic based on application secrets.

This package can also be run as-is, in which case the join server performs only signature validation and therefore allows anyone to join a Data Union.

## Authentication

The endpoints exposed by the join server expect requests to be signed with the requesting Ethereum wallet using a simple signature scheme. The details are below, however most users shouldn't need to implement the authentication from scratch, but instead simply use the [Data Union client](https://www.npmjs.com/package/@dataunions/client).

Requests to the join server look like this:

```
{
   "address": "0xf79d101E1243cbDdE02d0F49E776fA65de0122ed",
   "request": "{\"foo\":\"bar\"}",
   "timestamp": "2022-07-01T00:00:00.000Z",
   "signature": "0xefde1ff335c8fb28fe9f49c87c39c21659b5ad1a6967d154c4d4ea1978f572a02c7d82f8ab5828b7550246220919594bc84361cb50a89ce74a957eefc59dd4a41b"
}
```

- `request` - the actual request as stringified JSON
- `address` - the Ethereum address that originated the request
- `timestamp` - timestamp of the request in ISO 8601 format. The join server will by default reject requests with timestamps more than 5 minutes off from current time
- `signature` - a hex-encoded signature produced by signing the `request` with the private key of `address` using the Ethereum message signing (for example [`signer.signMessage()` in ethers](https://docs.ethers.io/v5/api/signer/#Signer-signMessage))

Different endpoints expect different types of content in `request`. Users that extend the server can add new endpoints and submit arbitrary `request` content.

## HTTP Endpoints

This base package only exposes one endpoint, which is used for submitting join requests.

### `/join`

Expects the `request` in the wrapper object to be of form:

```
{
    "dataUnion": "0x12345",
    "chain": "polygon"
}
```

or in other words, the full signed HTTP request body would be:

```
{
   "address": "0xabcdef",
   "request": "{\"dataUnion\":\"0x12345\",\"chain\":\"polygon\",}",
   "timestamp": "...",
   "signature": "..."
}
```

Such a request would join `address` (`0xabcdef`) as member of the Data Union at smart contract address `0x12345`, to be found on the Polygon chain.

The join request can contain arbitrary additional fields, which are validated by passing to the server a `customJoinRequestValidator` function - see below for information about extending and customizing the server.


## Usage

The most typical use case for this package is to extend the functionality of the join server by adding custom validation logic and/or additional HTTP endpoints.

- Start a new node.js project for your custom join server
- Install this base package as a dependency:

```
npm install --save @dataunions/join-server
```

- Then you can use the server in your application:

```
const { JoinServer } = require('@dataunions/JoinServer')

const srv = new JoinServer({
    // Always pass in the private key for the wallet you set as the joinPartAgent
    privateKey: '...',

    // Additional options, see below
    ...
})
srv.start()
```

### Adding custom fields to join requests

In many cases, you'll want to pass some additional information from the end-user app to the join server, such as CAPTCHA responses or other information used to accept the new member. In that case, the join request will have the `dataUnion` and `chain` keys plus your custom ones for which you can choose any names you want:

```
{
    "dataUnion": "0x12345",
    "chain": "polygon",
    "myCustomSecret": "foo"
}
```

To inject your custom validation logic to the join server, pass the `customJoinRequestValidator` function to the constructor. This is an async function (returns a promise) that is expected to resolve if the validation passes, or reject if it fails. For example:

```
const srv = new JoinServer({
    ...
    customJoinRequestValidator = async (joinRequest) => {
        if (joinRequest.myCustomSecret !== 'foo') {
            throw new Error('My custom secret is incorrect!')
        }
    },
})
```

### Adding custom endpoints

Custom endpoints (routes) can be created on the server by passing in a `customRoutes` function, which receives the `express` app instance as an argument.

All requests pass through the signature validation middleware, which makes the parsed and validated content of the `request` payload available as `req.validatedRequest`.

Here's a simple example of a custom endpoint `POST /hello` that reads payloads with a `message` field in them:

```
const srv = new JoinServer({
    ...
    customRoutes = (expressApp) => {
        app.post('/hello', function(req, res, next) {
            res.status(200)
            res.set('content-type', 'application/json')
            res.send({
                // Fields in the request payload can be accessed via req.validatedRequest
                message: req.validatedRequest.message,
                // Fields in the raw request (signed wrapper) can be accessed via req.body
                from: req.body.address,
            })
        })
    },
})
```

In the context of the signed message wrapper, the full request to this endpoint would look like this:

```
{
   "address": "...",
   "request": "{\"message\":\"Hi there!\"}",
   "timestamp": "...",
   "signature": "..."
}
```

### Options

See below for the various constructor options and their default values. At a minimum, you should pass in at least the `privateKey`.

```
new JoinServer({
    // Hex-encoded private key for your joinPartAgent address
    privateKey: '...', 

    // HTTP port the server listens on
    port: 5555,

    // Logger (pino) level: one of 'fatal', 'error', 'warn', 'info', 'debug', 'trace' or 'silent'.
    logLevel: 'info',

    // Used to validate custom fields in join requests. The default function does nothing.
    customJoinRequestValidator: async (joinRequest) => {},

    // Used to add custom routes to the HTTP server. The default function does nothing.
    customRoutes: (expressApp) => {},

    // By default public RPCs are used for each chain, but you can pass this option to override
    customRPCs: {
        polygon: 'https://my-custom-polygon-rpc-address',
        gnosis: 'https://my-custom-gnosis-rpc-address',
    }
})
```

## Developing

To learn about building and developing this software, see [developing.md](developing.md).
