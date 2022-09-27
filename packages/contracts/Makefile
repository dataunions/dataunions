LANG := en_US.UTF-8
SHELL := /bin/bash
.SHELLFLAGS := --noprofile --norc -e -u -o pipefail -c
.DEFAULT_GOAL := build

ifeq ($(shell uname), Darwin)
	OS := macosx
endif
ifeq ($(shell uname), Linux)
	OS := linux
endif

BUILD_DIR := build

$(BUILD_DIR):
	@mkdir -p $@

define parse_package_json
$(shell python3 -c "import sys, json; print(json.load(sys.stdin)$(1))" < package.json)
endef

OPENZEPPELIN_VERSION := $(call parse_package_json,['devDependencies']['@openzeppelin/contracts'])
OPENZEPPELIN_REPO_DIR := $(BUILD_DIR)/openzeppelin-contracts-$(OPENZEPPELIN_VERSION)
$(OPENZEPPELIN_REPO_DIR):
	git clone \
		--config advice.detachedHead=false \
		--depth 1 \
		--branch v$(OPENZEPPELIN_VERSION) \
		https://github.com/OpenZeppelin/openzeppelin-contracts.git $(OPENZEPPELIN_REPO_DIR)

SRC_DIR := contracts
SRCS := $(wildcard $(SRC_DIR)/*.sol) $(wildcard $(SRC_DIR)/*/*.sol)

SOLC_VERSION := $(shell grep -hE "^pragma solidity [[:digit:]]{1,3}\.[[:digit:]]{1,3}\.[[:digit:]]{1,3};$$" $(SRCS) | uniq | sed 's/^pragma solidity \(.*\);$$/\1/')
CURL := curl
CURL_FLAGS := \
	--silent \
	--location

SOLC_VERSION_FILE = $(shell $(CURL) $(CURL_FLAGS) https://binaries.soliditylang.org/$(OS)-amd64/list.txt | grep $(SOLC_VERSION))
SOLC_DIR := $(BUILD_DIR)/bin
SOLC := $(SOLC_DIR)/solc-$(OS)-$(SOLC_VERSION)

$(SOLC_DIR):
	@mkdir -p $@

$(SOLC): $(SOLC_DIR)
	$(CURL) --output $(SOLC) $(CURL_FLAGS) https://binaries.soliditylang.org/$(OS)-amd64/$(SOLC_VERSION_FILE)
	chmod 755 $(SOLC)

.PHONY: install-solc
install-solc: $(SOLC)

OBJ_DIR := $(BUILD_DIR)/resources/main/solidity
ABIS := $(patsubst $(SRC_DIR)/%.sol, $(OBJ_DIR)/%.abi, $(SRCS))
BINS := $(patsubst $(SRC_DIR)/%.sol, $(OBJ_DIR)/%.bin, $(SRCS))

$(OBJ_DIR):
	@mkdir -p $@

.PHONY: build
build: $(SOLC) $(OPENZEPPELIN_REPO_DIR) $(ABIS) $(BINS)

SOLC_FLAGS := \
	@openzeppelin=$(OPENZEPPELIN_REPO_DIR) \
	--evm-version constantinople \
	--optimize \
	--optimize-runs 200 \
	--overwrite \
	--allow-paths . \

$(OBJ_DIR)/%.abi: $(SRC_DIR)/%.sol | $(OBJ_DIR)
	$(SOLC) \
		$(SOLC_FLAGS) \
		--output-dir $(dir $@) \
		--abi \
		$<

$(OBJ_DIR)/%.bin: $(SRC_DIR)/%.sol | $(OBJ_DIR)
	$(SOLC) \
		$(SOLC_FLAGS) \
		--output-dir $(dir $@) \
		--bin \
		$<

.PHONY: clean
clean:
	@$(RM) -r \
		$(BUILD_DIR)

