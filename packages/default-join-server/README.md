# default-join-server

A Data Union join server that imports the [base join server](https://github.com/dataunions/data-union-join-server) and extends it by adding app join request validation based on app secrets stored in MySQL. The join server also supports granting access to [Streamr](https://streamr.network) streams when a member joins a Data Union that uses Streamr on the data transport layer.

An instance of this join server is run by the Data Union DAO to make it easier for Data Union builders to get started and control access to the Data Unions. Note that you can fork this join server and customize it to your needs, for example to implement additional validation for join requests or take some different action when after members join.

## Running

- Create a `.env` file containing your private key and DB config (see `.env.template` in the repo)
- Install: `npm install -g @dataunions/default-join-server`
- Start: `default-join-server`

## Join requests

The join request payloads are expected to contain an additional key `secret`, containing a valid app secret previously added to the data union via the `/secrets/create` endpoint.

An example join request:

```
{
	dataUnion: '0x12345',
	chain: 'polygon',
	secret: 'the-random-secret',
}
```

Note that as with the base server, the join request is expected to be wrapped in the signature wrapper:

```
{
   "address": "0xabcdef",
   "request": "{\"dataUnion\":\"0x12345\",\"chain\":\"polygon\",\"secret\":\"the-random-secret\"}",
   "timestamp": "...",
   "signature": "..."
}
```

For more information about the signature authentication, refer to the readme in the [base join server](https://github.com/dataunions/data-union-join-server).

## Secret management

The server adds three HTTP endpoints, callable by the DU owner only, to manage the app secrets. All requests are wrapped in the signature wrapper, but for clarity only the (non-stringified) `request` are illustrated here.

### `POST /secrets/create`

Creates a new secret for a given Data Union. Example `request` payload:

```
{
	"dataUnion": "0x12345",
	"chain": "polygon",
	"name": "A human-readable label for the new secret"
}
```

The response contains the generated `secret`:

```
{
	"secret": "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf",
	"dataUnion": "0x12345",
	"chain": "polygon",
	"name": "A human-readable label for the new secret"
}
```

### `POST /secrets/list`

Lists the secrets attached to the given Data Union. Example `request` payload:

```
{
	"dataUnion": "0x12345",
	"chain": "polygon"
}
```

The response contains an array of secrets:

```
[{
	"secret": "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf",
	"dataUnion": "0x12345",
	"chain": "polygon",
	"name": "A human-readable label for the new secret"
}]
```

### `POST /secrets/delete`

Deletes a secret attached to the given Data Union. Example `request` payload:

```
{
	"dataUnion": "0x12345",
	"chain": "polygon",
	"secret": "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf"
}
```

The response returns the deleted secret:

```
{
	"secret": "0fc6b4d6-6558-4c04-b42e-49a8ae5b5ebf",
	"dataUnion": "0x12345",
	"chain": "polygon",
	"name": "A human-readable label for the deleted secret"
}
```

### The secrets table

See [create_tables.sql](create_tables.sql) for the SQL to create the database table for the secrets.

## Streamr-awareness

After successfully adding a new member to the Data Union smart contract, this join server checks whether there are any [Streamr](https://streamr.network) streams associated with the Data Union, and grants the new member publish permission on those streams.

If you're using a different data protocol/backend, you should customize this behavior and grant access to your specific data backend to your new DU members (unless of course your backend accepts data from anyone, not just DU members).
