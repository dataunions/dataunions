[![Discord Chat](https://img.shields.io/discord/801574432350928907.svg?label=Streamr%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

[![Discord Chat](https://img.shields.io/discord/853941437602070549.svg?label=Data%20Union%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

# Data Union monorepo

`/packages`:
* `data-union-solidity`: Smart contracts for Data Unions 2.0
* `dataunion-thegraph-subgraph`: [TheGraph](https://thegraph.com/) subgraph for Data Union smart contracts
* `config`: Addresses and URLs for connecting to the deployed smart contracts
* `client`: Data Union client

## Development

Load project Node and npm:
```
nvm use
```

Install dependencies:
```
npm ci --workspaces
```

Build client:
```
npm run build --workspace=packages/client
```

Run unit tests for client:
```
npm test --workspace=packages/client
```

