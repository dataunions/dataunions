#!/bin/bash

set -e -u -o pipefail

function usage() {
	local name
	name=$(basename "$0")
	echo "$name: Validate Git repository is clean" 1>&2
	echo "Usage: $name [-h]" 1>&2
	echo "	-h Show help" 1>&2
	echo "Example: $name" 1>&2
}

while getopts "h" arg; do
	case $arg in
	h|*) # Show help
		usage
		exit 1
	;;
	esac
done

# check for unstaged changes
if ! git diff --exit-code --quiet; then
	echo "$(basename "$0"): error: git workspace is dirty" 1>&2
	exit 1
fi
# check for staged, but not committed changes
if ! git diff --cached --exit-code --quiet; then
	echo "$(basename "$0"): error: git workspace is dirty" 1>&2
	exit 1
fi
# check for no changes to be committed
if output=$(git status --porcelain=v1) && test -n "$output"; then
	echo "$(basename "$0"): error: git workspace is dirty" 1>&2
	exit 1
fi
