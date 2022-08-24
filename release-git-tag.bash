#!/bin/bash

set -e -u -o pipefail

function usage() {
	local name
	name=$(basename "$0")
	echo "$name: Tag new version in Git" 1>&2
	echo "Usage: $name [-h] semver" 1>&2
	echo "	-h Show help" 1>&2
	echo "Example: $name 0.2.7" 1>&2
}

while getopts "h" arg; do
	case $arg in
	h|*) # Show help
		usage
		exit 1
	;;
	esac
done

version="${1-}"
if test -z "$version"; then
	usage
	exit 1
fi

./release-validate-semver.bash "$version"

./release-npm-update-version-package-json.bash "$version"

# Create release commit
git commit --message="release: ${version}"
git push
# Create tag
git tag --message="Release ${version} $(date +"%Y-%m-%d")" --annotate "v${version}"
git push origin "v${version}"
