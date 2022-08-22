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
node_version = $(shell cat .nvmrc)
define npm
	@$(eval args=$(1))
	bash -e -o pipefail -l -c "source $(nvm_sh) && nvm exec $(node_version) npm $(args)"
endef
define node
	@$(eval args=$(1))
	bash -e -o pipefail -l -c "source $(nvm_sh) && nvm exec $(node_version) node $(args)"
endef

node_modules: ## Run 'npm ci' if directory doesn't exist
	$(call npm, ci)

.PHONY: npm-ci
npm-ci: node_modules ## Run npm ci

.PHONY: npm-install
npm-install: ## Run npm install
	$(call npm, --workspaces install)

.PHONY: npm-version
npm-version: ## Run npm install
ifndef VERSION
	$(error VERSION environment variable is not set)
endif
	$(call npm, --workspaces version $(VERSION))

.PHONY: npm-publish
npm-publish:
	$(call npm, publish . --access public --workspaces)

.PHONY: clean
clean: ## Remove generated files
	$(RM) -r \
		node_modules

