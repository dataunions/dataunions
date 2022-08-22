# Publish Release

## Goals
- Require Git branch is main
- Require Git workspace is clean
- Update version field in all `package.json` files
- Create release commit (commit can be empty with `--allow-empty`)
- Git tag release commit with semantic version
- npm release tag with semantic version.
- Create GitHub Release. Set name of the release to the value of semantic version and publish.

## Steps and commands
1. publish config
- npm publish packages/config --workspace packages/config --access public
1. publish eslint-config
- npm publish packages/eslint-config --workspace packages/eslint-config --access public
1. update eslint-config version to dev-config
- npm install @dataunions/eslint-config@$VERSION --workspace packages/dev-config
1. publish dev-config
- npm publish packages/dev-config --workspace packages/dev-config --access public
1. update config version to contracts
- npm install @dataunions/config@$VERSION --workspace packages/contracts
1. publish contracts
- npm publish packages/contracts --workspace packages/contracts --access public
1. update dev-config version to client
- npm install @dataunions/dev-config@$VERSION --workspace packages/client
1. update eslint-config version to client
- npm publish packages/eslint-config --workspace packages/client --access public
1. update contracts version to client
- npm install @dataunions/contracts@$VERSION --workspace packages/client
1. publish client
1. update client version to join-server
1. publish join-server
1. update join-server version to default-join-server
1. update client version to default-join-server
1. publish default-join-server
1. publish thegraph-subgraph
