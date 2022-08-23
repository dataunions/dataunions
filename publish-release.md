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
1. publish contracts
- npm publish packages/contracts --workspace packages/contracts --access public
1. update contracts version to client
- npm install @dataunions/contracts@$VERSION --workspace packages/client
1. publish client
- npm publish packages/client --workspace packages/client --access public
1. update client version to join-server
- npm install @dataunions/client@$VERSION --workspace packages/join-server
1. publish join-server
- npm publish packages/join-server --workspace packages/join-server --access public
1. update join-server version to default-join-server
- npm install @dataunions/join-server@$VERSION --workspace packages/default-join-server
1. update client version to default-join-server
- npm install @dataunions/client@$VERSION --workspace packages/default-join-server
1. publish default-join-server
- npm publish packages/default-join-server --workspace packages/default-join-server --access public
1. publish thegraph-subgraph
- npm publish packages/thegraph-subgraph --workspace packages/thegraph-subgraph --access public
