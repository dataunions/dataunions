[![Discord Chat](https://img.shields.io/discord/801574432350928907.svg?label=Streamr%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

[![Discord Chat](https://img.shields.io/discord/853941437602070549.svg?label=Data%20Union%20Discord&logo=Discord&colorB=7289da)](https://discord.gg/FVtAph9cvz)

# Data Union monorepo

`/packages`:
* `contracts`: Smart contracts for Data Unions 2.0 and 3.0 (`unichain`)
* `client`: Data Union client
* `thegraph-subgraph`: [TheGraph](https://thegraph.com/) subgraph for Data Union smart contracts
* `config`: Addresses and URLs for connecting to the deployed smart contracts

## Development

Monorepo is managed using [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces).

**Important:** Do not use `npm ci` or `npm install` directly in the sub-package directories.

### Load project Node and npm
```
nvm use
```

### Bootstrap all sub-packages
The go to command for most use cases.

To install all required dependencies and build all sub-packages (linking sub-packages together as needed):

```bash
# from top level
npm run bootstrap
```

###  Bootstrap a single sub-package

To install the required dependencies and build a specific sub-package:

```bash
# from top level
npm run bootstrap-pkg --package=$PACKAGE_NAME
```

### Install dependencies only

To only install required dependencies and link sub-packages together (and skip build phase):

```bash
# from top level
npm ci
```

### Build
To build all sub-packages:
```bash
# from top level
npm run build
```

### Build a sub-package
To build a specific sub-package:
```bash
# from top level
npm run build --workspace=$PACKAGE_NAME
```

### Clear caches and built files

To clear all caches and remove the `dist` directory from each sub-package:

```bash
# from top level
npm run clean-dist
```

### Clean all

To removes all caches, built files, and **`node_modules`** of each sub-package, and the
top-level **`node_modules`**:

```bash
# from top level
npm run clean
```

### Add a dependency into a sub-package

Manually add the entry to the `package.json` of the sub-package and 
run `npm run bootstrap-pkg $PACKAGE_NAME`.

Alternatively:
```bash
npm install some-dependency --workspace=$PACKAGE_NAME
```

### List active versions & symlinks

Check which sub-packages are currently being symlinked.

```bash
# from top level
npm run versions
```

This lists sub-packages & their versions on the left, linked
sub-packages are columns.  If the package on the left links to the package
in the column, it shows a checkmark & the semver range, otherwise it
shows the mismatched semver range and prints a warning at the end.  It
prints the version ranges so you can double-check that they're formatted
as you expect e.g. `^X.Y.Z` vs `X.Y.Z`

![image](https://user-images.githubusercontent.com/43438/135347920-97d6e0e7-b86c-40ff-bfc9-91f160ae975c.png)



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

