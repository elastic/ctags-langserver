import { InitializeParams, InitializeResult,
    DidChangeWorkspaceFoldersParams, DocumentSymbolParams,
    SymbolKind, Range, Position, SymbolInformation, TextDocumentPositionParams,
    Hover, MarkedString, Location, ReferenceParams, DocumentSymbol} from 'vscode-languageserver-protocol';
import { SymbolLocator, FullParams, Full, DetailSymbolInformation } from '@elastic/lsp-extension';

import { Logger, PrefixingLogger } from './logger';
import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// @ts-ignore
import * as ctags from '@elastic/node-ctags/ctags';
// @ts-ignore
import findRoot from 'find-root';
import { getOffsetOfLineAndCharacter, codeSelect, bestIndexOfSymbol, cutLineText, grep, toHierarchicalDocumentSymbol } from './utils';

export interface IServerOptions {
    logger: Logger;
    ctagsPath?: string;
}

const CTAGS_SUPPORT_LANGS = [
    'C',
    'C++',
    'Clojure',
    'C#',
    'CSS',
    'Go',
    'HTML',
    'Iniconf',
    'Kotlin',
    'Lua',
    'JSON',
    'ObjectiveC',
    'Pascal',
    'Perl',
    'PHP',
    'Python',
    'R',
    'Ruby',
    'Rust',
    'Scheme',
    'Sh',
    'SQL',
    'Swift',
    'Tcl',
    'TypeScript',
    'Java',
    'JavaScript',
  ];

export class LspServer {

    protected initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    private rootPaths: string[] = [];
    protected logger: Logger;
    readonly tagFileName = 'tags';
    readonly tmpTagName = 'tags.tmp';

    constructor(private options: IServerOptions) {
        this.logger = new PrefixingLogger(options.logger, '[lspserver]');
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.logger.log('initialize', params);
        this.initializeParams = params;

        const rootPath = fileURLToPath(params.rootUri!);
        await this.runCtags(rootPath);
        if (!existsSync(path.resolve(rootPath, this.tagFileName))) {
            this.logger.error(`Fail to initialize ${params.rootUri}`);
        } else {
            this.rootPaths.push(rootPath);
        }

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

    async didChangeWorkspaceFolders(params: DidChangeWorkspaceFoldersParams) {
        const added = params.event.added;
        const removed = params.event.removed;
        for (const add of added) {
            const rootPath = fileURLToPath(add.uri);
            await this.runCtags(rootPath);
            if (!existsSync(path.resolve(rootPath, this.tagFileName))) {
                this.logger.error(`Fail to initialize ${add.uri}`);
            } else {
                this.rootPaths.push(rootPath);
            }
        }
        removed.forEach(remove => {
            const index = this.rootPaths.indexOf(fileURLToPath(remove.uri));
            if (index !== -1) {
                this.rootPaths.splice(index, 1);
            }
        });
    }

    async documentSymbol(params: DocumentSymbolParams): Promise<DocumentSymbol[]> {
        this.logger.log('documentSymbol', params);
        const filePath = fileURLToPath(params.textDocument.uri);
        const rootPath = this.findBelongedRootPath(filePath);
        if (!rootPath) {
            return [];
        }
        const relativePath = path.relative(rootPath, filePath);
        return this.collectChildren(params.textDocument.uri).then(children => toHierarchicalDocumentSymbol(children, relativePath));
    }

    async full(params: FullParams): Promise<Full> {
        this.logger.log('full', params);
        const symbols: SymbolInformation[] = await this.collectChildren(params.textDocument.uri);
        const detailSymbols: DetailSymbolInformation[] = symbols.map(symbol => ({
            symbolInformation: symbol,
            qname: symbol.name
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
            // @ts-ignore
            ctags.findTags(path.resolve(rootPath, this.tagFileName), symbol, (error, tags) => {
                if (tags.length > 0) {
                    const tag = this.findClosestTag(tags, path.relative(rootPath, fileName), params.position.line + 1);
                    const tagFile = path.normalize(tag.file);
                    const tagLineNumber = tag.lineNumber;
                    const content = cutLineText(tag.pattern);
                    const markedString = `**${tagFile}: ${tagLineNumber}**\n\n${content}`;
                    resolve({
                        contents: markedString as MarkedString
                    });
                }
                resolve({
                    contents: '' as MarkedString
                });
            });
        });
    }

    async eDefinition(params: TextDocumentPositionParams): Promise<SymbolLocator[]> {
        this.logger.log('edefinition', params);
        const fileName: string = fileURLToPath(params.textDocument.uri);
        const rootPath = this.findBelongedRootPath(fileName);
        if (!rootPath) {
            return [];
        }
        const contents = readFileSync(fileName, 'utf8');
        const offset: number = getOffsetOfLineAndCharacter(contents, params.position.line + 1, params.position.character + 1);
        const symbol: string = codeSelect(contents, offset);
        return new Promise<SymbolLocator[]>(resolve => {
            if (symbol === '') {
                resolve(undefined);
            }
            // @ts-ignore
            ctags.findTags(path.resolve(rootPath, this.tagFileName), symbol, (error, tags) => {
                if (tags.length === 0) {
                    resolve([]);
                }
                let result: SymbolLocator[] = [];
                // @ts-ignore
                tags.forEach(tag => {
                    const destURI = pathToFileURL(path.resolve(rootPath, tag.file));
                    result.push({
                        location: Location.create(destURI.toString(), Range.create(Position.create(tag.lineNumber - 1, 0), Position.create(tag.lineNumber - 1, 0)))
                    });
                });
                resolve(result);
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
        let result: Location[] = [];
        // limit the serach scope within same file extension
        // TODO(pcxu): add map to indicate what file extensions a specific language supports
        (await grep(symbol, rootPath, `*${language}`, 1000)).forEach(match => {
            const startPos = Position.create(match.line, bestIndexOfSymbol(match.text, symbol));
            const endPos = Position.create(match.line, bestIndexOfSymbol(match.text, symbol) + symbol.length);
            result.push(Location.create(pathToFileURL(match.path).toString(), Range.create(startPos, endPos)));
        });
        return result;
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

    private async collectChildren(unitURI: string): Promise<SymbolInformation[]> {
        const filePath = fileURLToPath(unitURI);
        const rootPath = this.findBelongedRootPath(filePath);
        if (!rootPath) {
            return [];
        }
        const relativePath = path.relative(rootPath, filePath);
        await this.runCtagsOnSingleFile(rootPath, relativePath);
        if (!existsSync(path.resolve(rootPath, this.tmpTagName))) {
            this.logger.error(`Fail to generate tags for ${unitURI}`);
            return [];
        } else {
            const stream = ctags.createReadStream(path.resolve(rootPath, this.tmpTagName));
            return new Promise<SymbolInformation[]>(resolve => {
                let results: SymbolInformation[] = [];
                // @ts-ignore
                stream.on('data', (tags) => {
                    // @ts-ignore
                    for (let def of tags) {
                        let symbolInformation = SymbolInformation.create(def.name, SymbolKind.Method,
                            Range.create(Position.create(def.lineNumber - 1, 0), Position.create(def.lineNumber - 1, 0)), unitURI, relativePath);
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
                            } else if (def.fields.namespace) {
                                symbolInformation.containerName = def.fields.namespace;
                            } else if (def.fields.module) {
                                symbolInformation.containerName = def.fields.module;
                            }
                        }
                        switch (def.kind) {
                            case 'namespace':
                                symbolInformation.kind = SymbolKind.Namespace;
                                break;
                            case 'package':
                                symbolInformation.kind = SymbolKind.Package;
                                break;
                            case 'module':
                                symbolInformation.kind = SymbolKind.Module;
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
                                symbolInformation.kind = SymbolKind.Field;
                                break;
                            case 'typedef':
                                symbolInformation.kind = SymbolKind.Interface;
                                break;
                            case 'macro':
                                symbolInformation.kind = SymbolKind.Constant;
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
    }

    private findClosestTag(tags: any[], fileName: string, line: number) {
        // Priority for shoosing tags (high to low):
        // 1. if line number equal or less than given line
        // 2. absolute distance between two lines
        // 3. if in the same file
        const inFileTags = tags.filter(tag => path.normalize(tag.file) === path.normalize(fileName));
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

    private async runCtags(rootPath: string) {
        const params: string[] = [
            '--links=no',
            '--fields=-anf+iKnS',
            `--languages=${CTAGS_SUPPORT_LANGS.join(',')}`,
            '-R',
        ];
        this.addKotlinSupport(params);
        this.addSwiftSupport(params);
        const p = spawn(this.findCtagsPath(), params, { cwd: rootPath, stdio: 'pipe' });
        p.stderr.on('data', data => {
            this.logger.error(data.toString());
        });
        return new Promise((resolve) => {
            p.on('exit', () => resolve());
        });
    }

    private runCtagsOnSingleFile(rootPath: string, filePath: string) {
        if (filePath.trim().startsWith('-')) {
            this.logger.error(`Invalid file name: ${filePath}`);
            return;
        }
        const tmpTagsFile = path.resolve(rootPath, this.tmpTagName);
        if (existsSync(tmpTagsFile)) {
            unlinkSync(tmpTagsFile);
        }
        const params: string[] = [
            '--links=no',
            '--fields=-anf+iKnS',
            '-f',
            this.tmpTagName,
            filePath,
        ];
        const p = spawn(this.findCtagsPath(), params, { cwd: rootPath, stdio: 'pipe' });
        p.stderr.on('data', data => {
            this.logger.error(data.toString());
        });
        return new Promise((resolve) => {
            p.on('exit', () => resolve());
        });
    }

    // regex borrowed from https://github.com/oracle/opengrok/blob/master/opengrok-indexer/src/main/java/org/opengrok/indexer/analysis/Ctags.java
    private addSwiftSupport(command: string[]) {
        command.unshift(
            "--langdef=Swift",
            "--langmap=Swift:+.swift",
            "--regex-Swift=/enum[[:space:]]+([^\\{\\}]+).*$/\\1/n,enum,enums/",
            "--regex-Swift=/typealias[[:space:]]+([^:=]+).*$/\\1/t,typealias,typealiases/",
            "--regex-Swift=/struct[[:space:]]+([^:\\{]+).*$/\\1/s,struct,structs/",
            "--regex-Swift=/class[[:space:]]+([^:\\{]+).*$/\\1/c,class,classes/",
            "--regex-Swift=/func[[:space:]]+([^\\(\\)]+)\\([^\\(\\)]*\\)/\\1/f,function,functions/",
            "--regex-Swift=/(var|let)[[:space:]]+([^:=]+).*$/\\2/v,variable,variables/",
            "--regex-Swift=/^[[:space:]]*extension[[:space:]]+([^:\\{]+).*$/\\1/e,extension,extensions/",
        );
    }

    private addKotlinSupport(command: string[]) {
        command.unshift(
            "--langdef=Kotlin",
            "--langmap=Kotlin:+.kt",
            "--langmap=Kotlin:+.kts",
            // tslint:disable-next-line: max-line-length
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy)[[:space:]]*)*(private[^ ]*|protected)?[[:space:]]*class[[:space:]]+([[:alnum:]_:]+)/\\4/c,classes/",
            // tslint:disable-next-line: max-line-length
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy)[[:space:]]*)*(private[^ ]*|protected)?[[:space:]]*object[[:space:]]+([[:alnum:]_:]+)/\\4/o,objects/",
            // tslint:disable-next-line: max-line-length
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy)[[:space:]]*)*(private[^ ]*|protected)?[[:space:]]*((abstract|final|sealed|implicit|lazy)[[:space:]]*)*data class[[:space:]]+([[:alnum:]_:]+)/\\6/d,data classes/",
            // tslint:disable-next-line: max-line-length
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy)[[:space:]]*)*(private[^ ]*|protected)?[[:space:]]*interface[[:space:]]+([[:alnum:]_:]+)/\\4/i,interfaces/",
            "--regex-Kotlin=/^[[:space:]]*type[[:space:]]+([[:alnum:]_:]+)/\\1/T,types/",
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy|private[^ ]*(\\[[a-z]*\\])*|protected)[[:space:]]*)*fun[[:space:]]+([[:alnum:]_:]+)/\\4/m,methods/",
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy|private[^ ]*|protected)[[:space:]]*)*val[[:space:]]+([[:alnum:]_:]+)/\\3/C,constants/",
            "--regex-Kotlin=/^[[:space:]]*((abstract|final|sealed|implicit|lazy|private[^ ]*|protected)[[:space:]]*)*var[[:space:]]+([[:alnum:]_:]+)/\\3/v,variables/",
            "--regex-Kotlin=/^[[:space:]]*package[[:space:]]+([[:alnum:]_.:]+)/\\1/p,packages/",
            "--regex-Kotlin=/^[[:space:]]*import[[:space:]]+([[:alnum:]_.:]+)/\\1/I,imports/",
        );
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