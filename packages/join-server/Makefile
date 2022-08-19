LANG = en_US.UTF-8
SHELL := /bin/bash
.SHELLFLAGS := --norc --noprofile -e -u -o pipefail -c
.DEFAULT_GOAL := test

nvm_brew = /usr/local/opt/nvm/nvm.sh
ifneq ("$(wildcard $(nvm_brew))", "")
	nvm_sh = $(nvm_brew)
endif
nvm_default = $(HOME)/.nvm/nvm.sh
ifneq ("$(wildcard $(nvm_default))", "")
	nvm_sh = $(nvm_default)
endif
node_version = $(shell cat ../../.nvmrc)
define npm
	@$(eval args=$(1))
	bash -e -o pipefail -l -c "source $(nvm_sh) && nvm exec $(node_version) npm $(args)"
endef
define node
	@$(eval args=$(1))
	bash -e -o pipefail -l -c "source $(nvm_sh) && nvm exec $(node_version) node $(args)"
endef

../../node_modules: ## Run 'npm ci' if directory doesn't exist
	cd ../../ && $(MAKE) -f Makefile npm-ci

.PHONY: npm-ci
npm-ci: ../../node_modules ## Run npm ci

.PHONY: npm-install
npm-install: ## Run npm install
	cd ../../ && $(MAKE) -f Makefile npm-install

.PHONY: npm-publish
npm-publish: ## Run npm publish
	$(call npm, publish .)

.PHONY: npm-pack
npm-pack: ## Run npm pack
	$(call npm, pack)

.PHONY: test
test: ../../node_modules ## Run all test
	$(call node, $(NODE_BIN)/mocha --node-option trace-warnings --recursive --check-leaks --full-trace test)

NODE_BIN:=$(shell pwd)/../../node_modules/.bin
.PHONY: lint
lint: ## Run eslint
	$(call node, $(NODE_BIN)/eslint --config .eslintrc.js --ext .js .)

.PHONY: lint-fix
lint-fix: ## Run eslint with fix options
	$(call node, $(NODE_BIN)/eslint --config .eslintrc.js --ext .js --fix .)

# private key: 0x7013b52cd5bcefcb813252ba4fd19de4ffbc7be60cd3da017448bbd883b15457
# address: 0x516115E2a11393d1C91c41a14cCf2eFC1D6F5931
# public: 470e7f7704c995fcf1847e3543f9388809e57d1262afdc5b73781808ef57a0fb470f7fd2ac1056e6ae84a9d49f1631d145408807963ed3ba3df4dce4f96407a7
.PHONY: run
run: export PORT=8787
run: export NODE_ENV=development
run: export LOG_LEVEL=trace
run: export PRIVATE_KEY=0x7013b52cd5bcefcb813252ba4fd19de4ffbc7be60cd3da017448bbd883b15457
run: ## Run Data Union Join Server
	$(call node, src/cmd/join-server/main.js)

.PHONY: help
help: ## Show Help
	@grep -E '^[a-zA-Z0-9_\-\/]+%?:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-20s %s\n", $$1, $$2}' | sort
