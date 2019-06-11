import { RequestType, RequestHandler } from 'vscode-jsonrpc';
import { TextDocumentPositionParams } from 'vscode-languageserver';
import { SymbolLocator } from '@elastic/lsp-extension';

export namespace EDefinitionRequest {
    export const type = new RequestType<TextDocumentPositionParams, SymbolLocator, void, void>('textDocument/edefinition');
    export type HandlerSignature = RequestHandler<TextDocumentPositionParams, SymbolLocator | null, void>;
}