# Building Data Union
This project has two separate builds. One that is executed on CI server and one
that is executed on developers machine. Having two separate builds allows
independent development of each build.

## Continuous Integration Build
- CI system is GitHub Actions
- Build is defined in `.github/workflows/ci.yaml`
- Build is implemented by calling npm/node/mocha/jest tools directly from workflow file

## Developer Build
- Developer build is the build ran by developers during development
- Build is defined in various `Makefile`s
- Build reads `.nvmrc` and set Node and npm versions accordingly
- Build is implemented by calling npm/node/mocha/jest tools directly from `Makefile`

