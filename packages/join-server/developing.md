## Developing the Data Union join server

This section is intended for the developers of this software, not users of this software.

### Foreword
This project uses [`Makefile`](Makefile) instead of the usual `package.json` scripts. Firstly, this is done to ensure correct versions of Node and npm. Secondly, to allow dependencies between recipes.

[Nvm](https://github.com/nvm-sh/nvm#readme) is used to install Node and npm. Node version is specified in [`.nvmrc`](.nvmrc).

### Common Commands

Install dependencies from package.json to get started
```
make npm-ci
```

Run unit tests
```
make test
```

Then run Data Union Join Server
```
make run
```

Run eslint
```
make eslint
```

Run eslint with fix option
```
make eslint-fix
```

Run clean
```
make clean
```

Run help
```
make help
```

### API
- [NodeJS 16.x](https://nodejs.org/dist/latest-v16.x/docs/api/)
- [@dataunions/client 3.x](https://github.com/dataunions/data-unions/tree/master/packages/client)
- [@streamr/config 2.x](https://github.com/streamr-dev/network-contracts/tree/master/packages/config)
- [Express 5.x](https://expressjs.com/en/5x/api.html)
- [Commander.js](https://www.npmjs.com/package/commander)
- [Ethers API 5.x](https://docs.ethers.io/v5/api/)
- [Pino API 8.x](https://github.com/pinojs/pino/blob/master/docs/api.md)

#### Testing
- [Mocha](https://mochajs.org/api/)
- [Chai](https://www.chaijs.com/api/assert/)
- [Supertest](https://www.npmjs.com/package/supertest)
