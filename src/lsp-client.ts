import * as lsp from 'vscode-languageserver';
import { MessageConnection } from 'vscode-jsonrpc';

export interface LspClient {
    showMessage(args: lsp.ShowMessageParams): void;
    logMessage(args: lsp.LogMessageParams): void;
}

export class LspClientImpl implements LspClient {
    constructor(protected connection: MessageConnection) {
    }

    showMessage(args: lsp.ShowMessageParams): void {
        this.connection.sendNotification(lsp.ShowMessageNotification.type, args);
    }

    logMessage(args: lsp.LogMessageParams): void {
        this.connection.sendNotification(lsp.LogMessageNotification.type, args);
    }
}