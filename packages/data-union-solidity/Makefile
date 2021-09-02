LANG = en_US.UTF-8
SHELL = /bin/bash
.SHELLFLAGS = -eu -o pipefail -c
.DEFAULT_GOAL = build

ifeq ($(shell uname), Darwin)
	PLATFORM_SOLC = macosx-amd64
	PLATFORM_JQ = osx-amd64
endif
ifeq ($(shell uname), Linux)
	PLATFORM_SOLC = linux-amd64
	PLATFORM_JQ = linux64
endif

BUILD_TOOL_DIR = build/.bin
$(BUILD_TOOL_DIR):
	@mkdir -p $@

# find JQ downloads at https://stedolan.github.io/jq/download/
JQ = build/.bin/jq
$(JQ): $(BUILD_TOOL_DIR)
	curl -Lo $(JQ) https://github.com/stedolan/jq/releases/download/jq-1.6/jq-$(PLATFORM_JQ)
	chmod 755 $(JQ)

# find solc downloads at https://github.com/ethereum/solc-bin/
SOLC_VERSION = $(shell grep --color=never "^pragma solidity" contracts/DataUnionMainnet.sol |sed 's/pragma solidity \([0-9.]*\);/\1/')
SOLC_FILE = $(shell curl -s https://binaries.soliditylang.org/$(PLATFORM_SOLC)/list.txt |grep --color=never $(SOLC_VERSION))
SOLC = $(BUILD_TOOL_DIR)/solc-$(SOLC_VERSION)
$(SOLC): $(BUILD_TOOL_DIR)
	curl -o $(SOLC) https://binaries.soliditylang.org/$(PLATFORM_SOLC)/$(SOLC_FILE)
	chmod 755 $(SOLC)

.PHONY: install-tools
install-tools: $(SOLC) $(JQ)

# jq flags: [r]aw = no quotes; [c]ompact = no pretty printing; [M]onochrome output = no color
OPENZEPPELIN_VERSION = $(shell $(JQ) -crM '.dependencies["@openzeppelin/contracts"]' package.json)
OPENZEPPELIN_DIR = build/openzeppelin-$(OPENZEPPELIN_VERSION)/
$(OPENZEPPELIN_DIR): install-tools
	git clone -b v$(OPENZEPPELIN_VERSION) https://github.com/OpenZeppelin/openzeppelin-contracts.git $(OPENZEPPELIN_DIR)

.PHONY: install-dependencies
install-dependencies: $(OPENZEPPELIN_DIR)

SRC_DIR = contracts
SRCS = $(wildcard $(SRC_DIR)/*.sol)
ABI_DIR = build/contracts

$(ABI_DIR):
	@mkdir -p $@

ABIS := $(patsubst $(SRC_DIR)/%.sol, $(ABI_DIR)/%.abi, $(SRCS))

.PHONY: build
build: install-dependencies $(ABIS)

SOLC_FLAGS = \
	--evm-version constantinople \
	--optimize \
	--optimize-runs 200 \
	--output-dir $(ABI_DIR) \
	--overwrite \
	--abi \
	--bin \
	--allow-paths . \

$(ABI_DIR)/%.abi: $(SRC_DIR)/%.sol | $(ABI_DIR)
	$(SOLC) \
		$(SOLC_FLAGS) \
		@openzeppelin=$(OPENZEPPELIN_DIR) \
		$<

.PHONY: clean
clean:
	@$(RM) -r \
		$(ABI_DIR)

