# Data Union contracts package

The Data Union framework is a data crowdsourcing and crowdselling solution. Working in tandem with the Streamr Network and Ethereum, the framework powers applications that enable people to earn by sharing valuable data. You can [read more about it here](https://docs.dataunions.org/getting-started/intro-to-data-unions).

Data Union builders are encouraged to not use this package directly, but rather via the [@dataunions/client package](https://www.npmjs.com/package/@dataunions/client).

## @dataunions/contracts

The contracts for the multi-chain Data Unions (DU3) are found in `contracts`. They are also what this NPM package exports:
```typescript
import { DataUnionTemplate as templateJson, DataUnionFactory as factoryJson } from '@dataunions/contracts'
import type { DataUnionTemplate, DataUnionFactory } from '@dataunions/contracts/typechain'

import { ContractFactory, Contract } from 'ethers'
const factoryFactory = new ContractFactory(factoryJson.abi, factoryJson.bytecode, creatorWallet)
const factory = factoryFactory.deploy(templateAddress, tokenAddress, feeOracleAddress) as DataUnionFactory
const newDu = factory.deployNewDataUnion(adminAddress, adminFee, agents, metadata) as DataUnionTemplate
const existingDu = new Contract(templateJson.abi, duAddress, creatorWallet) as DataUnionTemplate
```

Old DU2 contracts are in `contracts/du2`.
