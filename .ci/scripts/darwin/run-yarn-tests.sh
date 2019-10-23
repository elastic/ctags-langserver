#!/bin/bash
set -euxo pipefail

NODE_VERSION=${1:?"Node version is required"}

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.0/install.sh | bash

source "${NVM_DIR}/nvm.sh"

nvm --version

nvm install ${NODE_VERSION}

nvm use --delete-prefix ${NODE_VERSION}

touch ~/.bashrc

curl -o- -L https://yarnpkg.com/install.sh | bash

yarn install

yarn test:ci
