#!/bin/bash

set -e -u -o pipefail

function usage() {
	local name
	name=$(basename "$0")
	echo "$name: Validate semantic version. Exists with error code 1 on validation error." 1>&2
	echo "Usage: $name [-h] semver" 1>&2
	echo "	-h Show help" 1>&2
	echo "Example: $name 0.2.7" 1>&2
}

SEMVER_REGEX="^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(\\-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$"
function validate_version {
	local version=$1
	if ! [[ "$version" =~ $SEMVER_REGEX ]]; then
		echo "$(basename "$0"): error: version $version does not match the semver scheme 'X.Y.Z(-PRERELEASE)(+BUILD)'." 1>&2
		exit 1
	fi
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

validate_version "$version"