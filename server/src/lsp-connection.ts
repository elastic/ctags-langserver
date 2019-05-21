import * as lsp from 'vscode-languageserver';

import { LspClientLogger } from './logger';
import { LspServer } from './lsp-server';
import { LspClientImpl } from './lsp-client';

export interface IServerOptions {
    ctagsPath: string;
    showMessageLevel: lsp.MessageType
}

export function createLspConnection(options: IServerOptions): lsp.IConnection {
    const connection = lsp.createConnection();
    const lspClient = new LspClientImpl(connection);
    const logger = new LspClientLogger(lspClient, options.showMessageLevel);
    const server: LspServer = new LspServer({
        logger,
        ctagsPath: options.ctagsPath
    });

    connection.onInitialize(server.initialize.bind(server));

    return connection;
}