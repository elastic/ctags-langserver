import * as lsp from 'vscode-languageserver';
import { LspServer } from './lsp-server';
import { DidChangeWorkspaceFoldersNotification } from 'vscode-languageserver';
import { LspClientLogger } from './logger';
import { LspClientImpl } from './lsp-client';
import { EDefinitionRequest, FullRequest } from './lsp-protocol.edefinition.proposed';
import { createServerSocketTransport } from 'vscode-languageserver-protocol';

export interface IServerOptions {
    ctagsPath: string;
    showMessageLevel: lsp.MessageType
    socketPort?: number;
}

export function createLspConnection(options: IServerOptions): lsp.IConnection {
    let connection: lsp.IConnection;
    if (options.socketPort !== undefined) {
        const [reader, writer] = createServerSocketTransport(this.port);
        connection = lsp.createConnection(reader, writer);
    } else {
        connection = lsp.createConnection();
    }
    const lspClient = new LspClientImpl(connection);
    const logger = new LspClientLogger(lspClient, options.showMessageLevel);
    const server: LspServer = new LspServer({
        logger,
        ctagsPath: options.ctagsPath
    });

    connection.onInitialize(server.initialize.bind(server));
    connection.onNotification(DidChangeWorkspaceFoldersNotification.type, server.didChangeWorkspaceFolders.bind(server));
    connection.onRequest(EDefinitionRequest.type, server.eDefinition.bind(server));
    connection.onRequest(FullRequest.type, server.full.bind(server));
    connection.onDocumentSymbol(server.documentSymbol.bind(server));
    connection.onHover(server.hover.bind(server));
    connection.onReferences(server.reference.bind(server));

    return connection;
}