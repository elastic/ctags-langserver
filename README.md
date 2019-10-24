# ctags-langserver

[![Build Status](https://apm-ci.elastic.co/buildStatus/icon?job=code%2Fcode-ctags-langserver%2Fmaster)](https://apm-ci.elastic.co/job/code/job/code-ctags-langserver/job/master/)

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
yarn start
```


# Development
If you want to file a issue, file it in: https://github.com/elastic/code/issues

### Build

```sh
yarn build
```

## Test

```sh
yarn test
```
