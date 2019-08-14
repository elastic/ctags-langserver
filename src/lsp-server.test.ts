import { SymbolKind, Range, Position, Hover, Location, TextDocumentIdentifier, DocumentSymbol } from 'vscode-languageserver-protocol';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pathToFileURL } from 'url';
import { LspServer } from './lsp-server';
import { ConsoleLogger } from './logger';
import { SymbolLocator, Full } from '@elastic/lsp-extension';

const content = "int max(int foo, int bar)\n" +
                    "{\n" +
                    "   int result;\n" +
                    " if (foo > bar)\n" +
                    "   result = foo;\n" +
                    " else\n" +
                    "   result = bar;\n" +
                    " return result;\n" +
                    "}\n" +
                    "int a = max(1, 2);"
let lspServer: LspServer;
let sourceFilePath: string;
let sourceFileUrl: string;
let rootPath: string;

beforeAll(async () => {
    rootPath = fs.mkdtempSync(path.resolve(os.tmpdir(), 'ctags-langserver'));
    sourceFilePath = path.resolve(rootPath, 'test.c');
    sourceFileUrl = pathToFileURL(sourceFilePath).toString();
    fs.writeFileSync(sourceFilePath, content);
    lspServer = new LspServer({
        logger: new ConsoleLogger()
    });
    await lspServer.initialize({
        processId: null,
        workspaceFolders: [],
        rootUri: pathToFileURL(rootPath).toString(),
        capabilities: {},
    });
    expect(fs.existsSync(path.resolve(rootPath, 'tags'))).toBe(true);
});

test('test didChangeWorkspaceFolders', () => {
    const addedRootPath = fs.mkdtempSync(path.resolve(os.tmpdir(), 'ctags-langserver'));
    const addedSourceFilePath = path.resolve(addedRootPath, 'test.c');
    fs.writeFileSync(addedSourceFilePath, content);
    lspServer.didChangeWorkspaceFolders({
        event: {
            added: [
                {
                    uri: pathToFileURL(addedRootPath).toString(),
                    name: "ctags-langserver"
                }
            ],
            removed: []
        }
    });
    expect(fs.existsSync(path.resolve(addedRootPath, 'tags'))).toBe(true);
})

test('test documentSymbol', async () => {
    const symbols: DocumentSymbol[] = await lspServer.documentSymbol({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl)
    });
    expect(symbols).toEqual([{
        name: 'a',
        kind: SymbolKind.Variable,
        range: Range.create(Position.create(9, 0), Position.create(9, 0)),
        selectionRange: Range.create(Position.create(9, 0), Position.create(9, 0)),
        children: []
    }, {
        name: 'max',
        kind: SymbolKind.Function,
        range: Range.create(Position.create(0, 0), Position.create(0, 0)),
        selectionRange: Range.create(Position.create(0, 0), Position.create(0, 0)),
        children: []
    }])
});

test('test full', async () => {
    const full: Full = await lspServer.full({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        reference: false
    });
    expect(full).toEqual({
        "references": [],
        "symbols": [{
            symbolInformation: {
                name: 'a',
                kind: SymbolKind.Variable,
                location: Location.create(sourceFileUrl, Range.create(Position.create(9, 0), Position.create(9, 0))),
                containerName: 'test.c'
            },
            qname: 'a'
        }, {
            symbolInformation: {
                name: 'max',
                kind: SymbolKind.Function,
                location: Location.create(sourceFileUrl, Range.create(Position.create(0, 0), Position.create(0, 0))),
                containerName: 'test.c'
            },
            qname: 'max'
        }]
    });
});

test('test definition', async () => {
    const def: SymbolLocator[] = await lspServer.eDefinition({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        position: Position.create(9, 9)
    });
    expect(def).toEqual([{
        location: Location.create(sourceFileUrl, Range.create(Position.create(0, 0), Position.create(0, 0)))
    }]);
});

test('test hover', async () => {
    const hover: Hover = await lspServer.hover({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        position: Position.create(9, 9)
    });
    expect(hover).toEqual({
        contents: '**test.c: 1**\n\nint max(int foo, int bar)'
    });
});

test('test references', async () => {
    const refs: Location[] = await lspServer.reference({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        position: Position.create(0, 4),
        context: {
            includeDeclaration: true
        }
    });
    expect(refs).toEqual([
        Location.create(sourceFileUrl, Range.create(Position.create(0, 4), Position.create(0, 7))),
        Location.create(sourceFileUrl, Range.create(Position.create(9, 8), Position.create(9, 11)))
    ])
});

test('test find belonged root path', () => {
    const belongedRootPath = lspServer.findBelongedRootPath(sourceFilePath);
    expect(belongedRootPath).toEqual(rootPath);
});
