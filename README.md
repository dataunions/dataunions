[![Discord Chat](https://img.shields.io/discord/801574432350928907.svg?label=Streamr%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

[![Discord Chat](https://img.shields.io/discord/853941437602070549.svg?label=Data%20Union%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

# Data Union monorepo

`/packages`:
* `contracts`: Smart contracts for Data Unions 2.0 and 3.0 (`unichain`)
* `client`: Data Union client
* `thegraph-subgraph`: [TheGraph](https://thegraph.com/) subgraph for Data Union smart contracts
* `config`: Addresses and URLs for connecting to the deployed smart contracts

## Development

Load project Node and npm:
```
nvm use
```

Install dependencies:
```
npm ci
```

Build client:
```
cd packages/client
npm run build
```

Run tests:
```
npm run test
```

