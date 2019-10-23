#!/bin/bash
set -euxo pipefail

NODE_VERSION=${1:?"Node version is required"}

function install_nvm() {
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash

    source "${NVM_DIR}/nvm.sh"

    nvm --version
}

function install_node() {
    nvm install ${NODE_VERSION}

    nvm use --delete-prefix ${NODE_VERSION}
}

function install_yarn() {
    touch ~/.bashrc

    curl -o- -L https://yarnpkg.com/install.sh | bash
}

function run_tests() {
    yarn install
    yarn test:ci
}

function main() {
    if ! [ -f "${HOME}/.nvm/nvm.sh" ]; then
        install_nvm
    fi

    if ! [ -x "$(command -v node)" ]; then
        install_node
    fi

    if ! [ -x "$(command -v yarn)" ]; then
        install_yarn
    fi
}

main "$@"