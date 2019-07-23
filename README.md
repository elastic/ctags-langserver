# ctags-langserver

[![Build Status](https://travis-ci.org/elastic/ctags-langserver.svg?branch=master)](https://travis-ci.org/elastic/ctags-langserver) [![Build Status](https://ci.appveyor.com/api/projects/status/github/elastic/ctags-langserver?branch=master&svg=true)]()

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
