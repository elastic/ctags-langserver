import * as lsp from 'vscode-languageserver';

export interface LspClient {
    showMessage(args: lsp.ShowMessageParams): void;
    logMessage(args: lsp.LogMessageParams): void;
}

export class LspClientImpl implements LspClient {
    constructor(protected connection: lsp.IConnection) {
    }

    showMessage(args: lsp.ShowMessageParams): void {
        this.connection.sendNotification(lsp.ShowMessageNotification.type, args);
    }

    logMessage(args: lsp.LogMessageParams): void {
        this.connection.sendNotification(lsp.LogMessageNotification.type, args);
    }
}