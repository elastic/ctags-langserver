import { SymbolKind, Range, Position, SymbolInformation, Hover, Location, TextDocumentIdentifier} from 'vscode-languageserver-protocol';
import * as fs from 'fs';
import * as path from 'path';
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

beforeAll(async () => {
    const rootPath = fs.mkdtempSync('/tmp/ctags-langserver');
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

test('test documentSymbol', async () => {
    const symbols: SymbolInformation[] = await lspServer.documentSymbol({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl)
    });
    expect(symbols).toEqual([{
        name: 'a',
        kind: SymbolKind.Variable,
        location: Location.create(sourceFileUrl, Range.create(Position.create(9, 0), Position.create(9, 0))),
        containerName: 'test.c'
    }, {
        name: 'max',
        kind: SymbolKind.Function,
        location: Location.create(sourceFileUrl, Range.create(Position.create(0, 0), Position.create(0, 0))),
        containerName: 'test.c'
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
        }, {
            symbolInformation: {
                name: 'max',
                kind: SymbolKind.Function,
                location: Location.create(sourceFileUrl, Range.create(Position.create(0, 0), Position.create(0, 0))),
                containerName: 'test.c'
            }
        }]
    });
});

test('test definition', async () => {
    const def: SymbolLocator = await lspServer.eDefinition({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        position: Position.create(9, 9)
    })
    expect(def).toEqual({
        location: Location.create(sourceFileUrl, Range.create(Position.create(0, 0), Position.create(0, 0)))
    })
});

test('test hover', async () => {
    const hover: Hover = await lspServer.hover({
        textDocument: TextDocumentIdentifier.create(sourceFileUrl),
        position: Position.create(9, 9)
    });
    expect(hover).toEqual({
        contents: 'int max(int foo, int bar)'
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
