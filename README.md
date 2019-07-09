# ctags-langserver

[![Build Status](https://travis-ci.org/elastic/ctags-langserver.svg?branch=master)](https://travis-ci.org/elastic/ctags-langserver)

# Supported Protocol features

- [x] textDocument/edefinition (extension)
- [x] textDocument/full (extension)
- [x] textDocument/documentSymbol
- [x] textDocument/hover
- [x] textDocument/references
- [x] workspace/didChangeWorkspaceFolders

# Installing

```sh
npm install -g @elastic/ctags-langserver
```

# Running the language server

```
node @elastic/ctags-langserver/lib/cli.js --socket=2092
```


# Development
If you want to file a issue, file it in: https://github.com/elastic/code/issues

### Build

```sh
yarn
yarn compile
```

## Test

```sh
yarn test
```
