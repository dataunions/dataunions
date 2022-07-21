# @dataunions/contracts

[![Discord Chat](https://img.shields.io/discord/801574432350928907.svg?label=Streamr Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

[![Discord Chat](https://img.shields.io/discord/853941437602070549.svg?label=Data Union Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

The Data Union framework is a data crowdsourcing and crowdselling solution. Working in tandem with the Streamr Network and Ethereum, the framework powers applications that enable people to earn by sharing valuable data. You can [read more about it here](https://dataunions.network/docs/data-unions/intro-to-data-unions)

The contracts for the upcoming "multi-chain" Data Unions are found in `contracts/unichain`. They are also what this NPM package exports:
```javascript
import { dataUnionTemplate as templateJson, dataUnionFactory as factoryJson } from '@dataunions/contracts'
import type { DataUnionTemplate, DataUnionFactory } from '@dataunions/contracts/typechain'
```
