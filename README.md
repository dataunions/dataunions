# data-union-joining-server

- [production](http://kraken-frontend.eba-73nbhbmu.eu-central-1.elasticbeanstalk.com/)

## Development

### Foreword
This project uses [`Makefile`](./blob/main/Makefile) instead of the usual `package.json` scripts. Firstly, this is done to ensure correct versions of Node and npm. Secondly, to allow dependencies between recipes.

[Nvm](https://github.com/nvm-sh/nvm#readme) is used to install Node and npm. Node version is specified in [`.nvmrc`](./blob/main/.nvmrc).

### Common Commands

Install dependencies from package.json to get started
```
make npm-ci
```

Run unit tests
```
make test
```

Setup Docker environment
```
make docker-setup
```

First run mongodb in one terminal window
```
make run-mongo
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

Run mongo cli
```
make run-mongo-cli
```

Run clean
```
make clean
```

Clean Docker environment
```
make docker-clean
```

Run help
```
make help
```

### API

- [NodeJS 16.x](https://nodejs.org/dist/latest-v16.x/docs/api/)
- [Express 5.x](https://expressjs.com/en/5x/api.html)
- [Commander.js](https://www.npmjs.com/package/commander)
- [Ethers API 5.x](https://docs.ethers.io/v5/api/)
- [MongoDB Node API 4.5](https://mongodb.github.io/node-mongodb-native/4.5/)
- [Pino API 7.x](https://github.com/pinojs/pino/blob/master/docs/api.md)

#### Testing
- [Mocha](https://mochajs.org/api/)
- [Chai](https://www.chaijs.com/api/assert/)
- [Supertest](https://www.npmjs.com/package/supertest)
