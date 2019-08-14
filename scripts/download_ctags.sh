#!/usr/bin/env bash
set -e

CTAGS_VERSION=0.1.1

BINARY_HOST_MIRROR="https://github.com/elastic/ctags/releases/download/v${CTAGS_VERSION}/"

for FILE in ctags-linux ctags-darwin ctags-win32.exe; do
        wget "${BINARY_HOST_MIRROR}${FILE}"
        if test -f $FILE; then
                chmod 755 $FILE
                mv $FILE ./vendor
        fi
done
