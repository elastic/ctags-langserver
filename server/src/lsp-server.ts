import { InitializeParams, InitializeResult, DidChangeWorkspaceFoldersParams} from 'vscode-languageserver-protocol';

import { Logger, PrefixingLogger } from './logger';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

export interface IServerOptions {
    logger: Logger;
    ctagsPath?: string;
}

var uri2path = require('file-uri-to-path');
export class LspServer {

    protected initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    protected logger: Logger;
    readonly tagFileName = 'tags'

    constructor(private options: IServerOptions) {
        this.logger = new PrefixingLogger(options.logger, '[lspserver]');
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.logger.log('initialize', params);
        this.initializeParams = params;

        const rootPath = uri2path(params.rootUri);
        this.runCtags(rootPath);

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
        const rootPath = uri2path(params.event.added[0].uri);
        this.runCtags(rootPath);
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
        } catch(err) {
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