import { InitializeParams, InitializeResult,
    DidChangeWorkspaceFoldersParams, DocumentSymbolParams,
    SymbolKind, Range, Position, SymbolInformation, TextDocumentPositionParams, Hover, MarkedString, Location, ReferenceParams} from 'vscode-languageserver-protocol';
import { SymbolLocator, FullParams, Full, DetailSymbolInformation } from '@elastic/lsp-extension';

import { Logger, PrefixingLogger } from './logger';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import * as grep from 'grep1';
import { fileURLToPath, pathToFileURL } from 'url';
import * as ctags from 'nuclide-prebuilt-libs/ctags';
import * as findRoot from 'find-root';
import { getOffsetOfLineAndCharacter, codeSelect, bestIndexOfSymbol, cutLineText } from './utils';

export interface IServerOptions {
    logger: Logger;
    ctagsPath?: string;
}

export class LspServer {

    protected initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    private rootPaths: string[] = [];
    protected logger: Logger;
    readonly tagFileName = 'tags'

    constructor(private options: IServerOptions) {
        this.logger = new PrefixingLogger(options.logger, '[lspserver]');
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.logger.log('initialize', params);
        this.initializeParams = params;

        const rootPath = fileURLToPath(params.rootUri!);
        this.runCtags(rootPath);
        this.rootPaths.push(rootPath);

        this.initializeResult = {
            capabilities: {
                definitionProvider: true,
                documentSymbolProvider: true,
                hoverProvider: true,
                referencesProvider: true,
            },
        };
        this.logger.log('onInitialize result', this.initializeResult);
        return this.initializeResult;
    }

    didChangeWorkspaceFolders(params: DidChangeWorkspaceFoldersParams) {
        const added = params.event.added;
        const removed = params.event.removed;
        added.forEach(add => {
            const rootPath = fileURLToPath(add.uri);
            this.runCtags(rootPath);
            this.rootPaths.push(rootPath);
        });
        removed.forEach(remove => {
            const index = this.rootPaths.indexOf(fileURLToPath(remove.uri));
            if (index !== -1) {
                this.rootPaths.splice(index, 1);
            }
        });
    }

    async documentSymbol(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
        this.logger.log('documentSymbol', params);
        const filePath = fileURLToPath(params.textDocument.uri);
        const rootPath = this.findBelongedRootPath(filePath);
        if (!rootPath) {
            return [];
        }
        const relativePath = path.relative(rootPath, filePath);
        const stream = ctags.createReadStream(path.resolve(rootPath, this.tagFileName));
        return new Promise<SymbolInformation[]>(resolve => {
            let results: SymbolInformation[] = [];
            stream.on('data', (tags) => {
                const definitions = tags.filter(tag => tag.file === relativePath);
                for (let def of definitions) {
                    let symbolInformation = SymbolInformation.create(def.name, SymbolKind.Method,
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

    async full(params: FullParams): Promise<Full> {
        this.logger.log('full', params);
        const symbols: SymbolInformation[] = await this.documentSymbol({ textDocument: params.textDocument});
        const detailSymbols: DetailSymbolInformation[] = symbols.map(symbol => ({
            symbolInformation: symbol
        }));
        if (params.reference) {
            // TODO(pcxu): add references
        }
        return {
            symbols: detailSymbols,
            references: []
        };
    }

    async hover(params: TextDocumentPositionParams): Promise<Hover> {
        this.logger.log('hover', params);
        const fileName: string = fileURLToPath(params.textDocument.uri);
        const rootPath = this.findBelongedRootPath(fileName);
        if (!rootPath) {
            return { contents: '' };
        }
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        return new Promise<Hover>(resolve => {
            if (symbol === '') {
                resolve({
                    contents: '' as MarkedString
                });
            }
            ctags.findTags(path.resolve(rootPath, this.tagFileName), symbol, (error, tags) => {
                if (tags.length > 0) {
                    const tag = this.findClosestTag(tags, path.relative(rootPath, fileName), params.position.line + 1);
                    resolve({
                        contents: cutLineText(tag.pattern) as MarkedString
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
        const rootPath = this.findBelongedRootPath(fileName);
        if (!rootPath) {
            return {};
        }
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        return new Promise<SymbolLocator>(resolve => {
            if (symbol === '') {
                resolve(undefined);
            }
            ctags.findTags(path.resolve(rootPath, this.tagFileName), symbol, (error, tags) => {
                if (tags.length > 0) {
                    const tag = this.findClosestTag(tags, path.relative(rootPath, fileName), params.position.line + 1);
                    const destURI = pathToFileURL(path.resolve(rootPath, tag.file));
                    resolve({
                        location: Location.create(destURI.toString(), Range.create(Position.create(tag.lineNumber - 1, 0), Position.create(tag.lineNumber - 1, 0)))
                    });
                }
                resolve(undefined);
            });
        });
    }

    async reference(params: ReferenceParams): Promise<Location[]> {
        this.logger.log('references', params);
        const fileName: string = fileURLToPath(params.textDocument.uri);
        const rootPath = this.findBelongedRootPath(fileName);
        if (!rootPath) {
            return [];
        }
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        const language: string = path.extname(fileName);
        return new Promise<Location[]>(resolve => {
            // limit the serach scope within same file extension
            grep(['-n', symbol, '-R', `--include=*${language}`, rootPath], function(err, stdout: string, stderr) {
                if (err || stderr) {
                    this.logger.error(err);
                    resolve(undefined);
                } else {
                    // $file:$line:content
                    let result: Location[] = [];
                    stdout.split('\n').forEach(line => {
                        if (line !== '') {
                            const ref = line.split(':', 2);
                            const file = ref[0].replace('//', '/');
                            const lineNumber = parseInt(ref[1], 10);
                            const content = line.substr(ref.join(':').length + 1 - line.length);
                            const startPos = Position.create(lineNumber - 1, bestIndexOfSymbol(content, symbol));
                            const endPos = Position.create(lineNumber - 1, bestIndexOfSymbol(content, symbol) + symbol.length);
                            result.push(Location.create(pathToFileURL(file).toString(), Range.create(startPos, endPos)));
                        }
                    });
                    resolve(result);
                }
              });
        });
    }

    public findBelongedRootPath(filePath: string): string {
        const rootPath = this.rootPaths.find(rootPath => {
            return filePath.startsWith(rootPath);
        });
        if (!rootPath) {
            this.logger.error(`cannot find belonged root path for: ${filePath}`);
            return '';
        }
        return rootPath;
    }

    private findClosestTag(tags: any[], fileName: string, line: number) {
        // Priority for shoosing tags (high to low):
        // 1. if line number equal or less than given line
        // 2. absolute distance between two lines
        // 3. if in the same file
        const inFileTags = tags.filter(tag => tag.file = fileName);
        if (inFileTags.length !== 0) {
            inFileTags.sort(function(l, r) {
                return (Math.abs(l.lineNumber - line) - Math.abs(r.lineNumber - line));
            });
            inFileTags.forEach(tag => {
                if (tag.lineNumber <= line) {
                    return tag;
                }
            });
            return inFileTags[0];
        }
        return tags[0];
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
            const packageRoot = findRoot(__filename);
            return path.join(packageRoot, 'vendor', `ctags-${process.platform}`);
        }
    }

}