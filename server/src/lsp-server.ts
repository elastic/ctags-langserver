import { InitializeParams, InitializeResult } from 'vscode-languageserver-protocol';

import { Logger, PrefixingLogger } from './logger';

export interface IServerOptions {
    logger: Logger;
    ctagsPath?: string
}

export class LspServer {

    protected initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    protected logger: Logger;

    constructor(private options: IServerOptions) {
        this.logger = new PrefixingLogger(options.logger, '[lspserver]');
    }

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        this.logger.log('initialize', params);
        this.initializeParams = params;

        // const ctagsPath = this.findCtagsPath();

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

    protected findCtagsPath(): string|undefined {
        if (this.options.ctagsPath) {
            return this.options.ctagsPath;
        }
    }

}