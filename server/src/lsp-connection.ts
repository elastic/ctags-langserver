import * as net from 'net';
import * as lsp from 'vscode-languageserver';

import {
    createMessageConnection,
    SocketMessageReader,
    SocketMessageWriter,
  } from 'vscode-jsonrpc';

import { LspServer } from './lsp-server';
import { InitializeParams, DidChangeWorkspaceFoldersParams, DocumentSymbolParams, TextDocumentPositionParams } from 'vscode-languageserver';
import { ConsoleLogger, LspClientLogger } from './logger';
import { LspClientImpl } from './lsp-client';
import { FullParams } from '@elastic/lsp-extension';

export interface IServerOptions {
    ctagsPath: string;
    showMessageLevel: lsp.MessageType;
    lspPort: number
}

export function createLspConnection(options: IServerOptions) {
    const consoleLogger = new ConsoleLogger();
    let counter = 1;
    const server = net.createServer(socket => {
        const id = counter++;
        consoleLogger.log(`Connection ${id} accepted`);

        const messageReader = new SocketMessageReader(socket);
        const messageWriter = new SocketMessageWriter(socket);
        const clientConnection = createMessageConnection(messageReader, messageWriter, this.logger);

        const lspClient = new LspClientImpl(clientConnection);
        const logger = new LspClientLogger(lspClient, options.showMessageLevel);

        const lspServer = new LspServer({
            logger: logger,
            ctagsPath: options.ctagsPath
        });

        // Add exit notification handler to close the socket on exit
        clientConnection.onNotification('exit', () => {
            socket.end();
            socket.destroy();
            consoleLogger.log(`Connection ${id} closed (exit notification)`);
        });

        clientConnection.onRequest('initialize', async (params: InitializeParams) => {
            return await lspServer.initialize(params);
        });

        clientConnection.onRequest('workspace/didChangeWorkspaceFolders', (params: DidChangeWorkspaceFoldersParams) => {
            lspServer.didChangeWorkspaceFolders(params);
        });

        clientConnection.onRequest('textDocument/documentSymbol', async (params: DocumentSymbolParams) => {
            return await lspServer.documentSymbol(params);
        });

        // clientConnection.onRequest('textDocument/full', async (params: FullParams) => {
        //     return await lspServer.documentSymbol(params);
        // });

        clientConnection.onRequest('textDocument/hover', async (params: TextDocumentPositionParams) => {
            return await lspServer.hover(params);
        });

        clientConnection.onRequest('textDocument/edefinition', async (params: TextDocumentPositionParams) => {
            return await lspServer.eDefinition(params);
        });
        
        clientConnection.listen();
    });

    server.listen(options.lspPort, () => {
        consoleLogger.info(`Listening for incoming LSP connections on ${options.lspPort}`)
    });
}