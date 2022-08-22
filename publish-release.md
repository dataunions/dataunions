# Publish Release

## Goals
- Require Git branch is main
- Require Git workspace is clean
- Update version field in all `package.json` files
- Create release commit (commit can be empty with `--allow-empty`)
- Git tag release commit with semantic version
- npm release tag with semantic version.
- Create GitHub Release. Set name of the release to the value of semantic version and publish.
