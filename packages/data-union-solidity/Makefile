LANG = en_US.UTF-8
SHELL = /bin/bash
.SHELLFLAGS = -eu -o pipefail -c
.DEFAULT_GOAL = build

ifeq ($(shell uname), Darwin)
	OS = macosx
endif
ifeq ($(shell uname), Linux)
	OS = linux
endif

SOLC_VERSION = 0.8.6
SOLC_DIR = build/.solcbin
SOLC = $(SOLC_DIR)/solc-$(OS)-$(SOLC_VERSION)

$(SOLC_DIR):
	@mkdir -p $@

$(SOLC): $(SOLC_DIR)
	curl -o $(SOLC) https://binaries.soliditylang.org/$(OS)-amd64/solc-macosx-amd64-v0.8.6+commit.11564f7e
	chmod 755 $(SOLC)

.PHONY: install-solc
install-solc: $(SOLC)

SRC_DIR = contracts
SRCS = $(wildcard $(SRC_DIR)/*.sol)
ABI_DIR = build/resources/main/solidity

$(ABI_DIR):
	@mkdir -p $@

ABIS := $(patsubst $(SRC_DIR)/%.sol, $(ABI_DIR)/%.abi, $(SRCS))

.PHONY: build
build: $(SOLC) $(ABIS)

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
		@openzeppelin=openzeppelin-contracts \
		$<

.PHONY: clean
clean:
	@$(RM) -r \
		$(ABI_DIR)

