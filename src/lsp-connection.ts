import * as lsp from 'vscode-languageserver';
import { LspServer } from './lsp-server';
import { DidChangeWorkspaceFoldersNotification } from 'vscode-languageserver';
import { LspClientLogger } from './logger';
import { LspClientImpl } from './lsp-client';
import { EDefinitionRequest } from './lsp-protocol.edefinition.proposed';

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
    connection.onNotification(DidChangeWorkspaceFoldersNotification.type, server.didChangeWorkspaceFolders.bind(server));
    connection.onRequest(EDefinitionRequest.type, server.eDefinition.bind(server));
    connection.onDocumentSymbol(server.documentSymbol.bind(server));
    connection.onHover(server.hover.bind(server));
    connection.onReferences(server.reference.bind(server));

    return connection;
}