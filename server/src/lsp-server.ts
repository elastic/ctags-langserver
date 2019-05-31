import { InitializeParams, InitializeResult,
    DidChangeWorkspaceFoldersParams, DocumentSymbolParams,
    SymbolKind, Range, Position, SymbolInformation, TextDocumentPositionParams, Hover, MarkedString, Location} from 'vscode-languageserver-protocol';
import { SymbolLocator } from '@elastic/lsp-extension';

import { Logger, PrefixingLogger } from './logger';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as ctags from 'nuclide-prebuilt-libs/ctags';
import { getOffsetOfLineAndCharacter, codeSelect } from './utils';

export interface IServerOptions {
    logger: Logger;
    ctagsPath?: string;
}

export class LspServer {

    protected initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    private rootPath: string;
    protected logger: Logger;
    readonly tagFileName = 'tags'

    constructor(private options: IServerOptions) {
        this.logger = new PrefixingLogger(options.logger, '[lspserver]');
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.logger.log('initialize', params);
        this.initializeParams = params;

        this.rootPath = fileURLToPath(params.rootUri!);
        this.runCtags(this.rootPath);

        this.initializeResult = {
            capabilities: {
                definitionProvider: true,
                documentSymbolProvider: true,
                hoverProvider: true,
            },
        };
        this.logger.log('onInitialize result', this.initializeResult);
        return this.initializeResult;
    }

    didChangeWorkspaceFolders(params: DidChangeWorkspaceFoldersParams) {
        this.rootPath = fileURLToPath(params.event.added[0].uri);
        this.runCtags(this.rootPath);
    }

    async documentSymbol(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
        this.logger.log('documentSymbol', params);
        const filePath = fileURLToPath(params.textDocument.uri);
        const relativePath = path.relative(this.rootPath, filePath);
        const stream = ctags.createReadStream(path.resolve(this.rootPath, this.tagFileName));
        return new Promise<SymbolInformation[]>(resolve => {
            let results: SymbolInformation[] = [];
            stream.on('data', (tags) => {
                const definitions = tags.filter(tag => tag.file === relativePath);
                for (let def of definitions) {
                    let symbolInformation = SymbolInformation.create(def.name, SymbolKind.Array,
                        Range.create(Position.create(def.lineNumber - 1, 0), Position.create(def.lineNumber - 1, 0)), params.textDocument.uri, relativePath);
                    if (def.fields !== undefined) {
                        if (def.fields.struct) {
                            symbolInformation.containerName = def.fields.struct;
                        } else if (def.fields.class) {
                            symbolInformation.containerName = def.fields.class;
                        }  else if (def.fields.interface) {
                            symbolInformation.containerName = def.fields.interface;
                        } else if (def.fields.function) {
                            symbolInformation.containerName = def.fields.function;
                        } else if (def.fields.enum) {
                            symbolInformation.containerName = def.fields.enum;
                        }
                    }
                    switch (def.kind) {
                        case 'namespace':
                            symbolInformation.kind = SymbolKind.Namespace;
                            break;
                        case 'variable':
                            symbolInformation.kind = SymbolKind.Variable;
                            break;
                        case 'function':
                            symbolInformation.kind = SymbolKind.Function;
                            break;
                        case 'class':
                            symbolInformation.kind = SymbolKind.Class;
                            break;
                        case 'field':
                            symbolInformation.kind = SymbolKind.Field;
                            break;
                        case 'method':
                            symbolInformation.kind = SymbolKind.Method;
                            break;
                        case 'struct':
                            symbolInformation.kind = SymbolKind.Struct;
                            break;
                        case 'enum':
                            symbolInformation.kind = SymbolKind.Enum;
                            break;
                        case 'enumerator':
                            symbolInformation.kind = SymbolKind.EnumMember;
                            break;
                        case 'member':
                            symbolInformation.kind = SymbolKind.Method;
                            break;
                        default:
                            break;
                    }
                    results.push(symbolInformation);
                }
            });
            stream.on('end', () => {
                resolve(results);
            });
        });
    }

    async hover(params: TextDocumentPositionParams): Promise<Hover> {
        this.logger.log('hover', params);
        const fileName: string = fileURLToPath(params.textDocument.uri);
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        return new Promise<Hover>(resolve => {
            if (symbol === '') {
                resolve({
                    contents: '' as MarkedString
                });
            }
            ctags.findTags(path.resolve(this.rootPath, this.tagFileName), symbol, (error, tags) => {
                for (let tag of tags) {
                    resolve({
                        contents: tag.pattern as MarkedString
                    });
                }
                resolve({
                    contents: '' as MarkedString
                });
            });
        });
    }

    async eDefinition(params: TextDocumentPositionParams): Promise<SymbolLocator> {
        this.logger.log('edefinition', params);
        const fileName: string = fileURLToPath(params.textDocument.uri);
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        return new Promise<SymbolLocator>(resolve => {
            if (symbol === '') {
                resolve(undefined);
            }
            ctags.findTags(path.resolve(this.rootPath, this.tagFileName), symbol, (error, tags) => {
                for (let tag of tags) {
                    const destURI = pathToFileURL(path.resolve(this.rootPath, tag.file));
                    resolve({
                        location: Location.create(destURI.toString(), Range.create(Position.create(tag.lineNumber - 1, 0), Position.create(tag.lineNumber - 1, 0)))
                    });
                }
                resolve(undefined);
            });
        });
    }

    private runCtags(rootPath: string) {
        const ctagsPath = this.findCtagsPath();
        try {
            execSync(`${ctagsPath} --fields=-anf+iKnS -R .`, { cwd: rootPath });
        } catch (err) {
            this.logger.error(`Fail to run ctags command with exit code ${err.status}`);
            this.logger.error(`${err.stderr}`);
        }

        try {
            if (!existsSync(path.resolve(rootPath, this.tagFileName))) {
                this.logger.error(`Cannot find tag file in ${path.resolve(rootPath, this.tagFileName)}`);
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    protected findCtagsPath(): string {
        if (this.options.ctagsPath) {
            return this.options.ctagsPath;
        } else {
            return 'ctags';
        }
    }

}