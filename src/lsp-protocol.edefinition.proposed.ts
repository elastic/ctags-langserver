import { RequestType, RequestHandler } from 'vscode-jsonrpc';
import { TextDocumentPositionParams } from 'vscode-languageserver';
import { SymbolLocator, FullParams, Full } from '@elastic/lsp-extension';

export namespace EDefinitionRequest {
    export const type = new RequestType<TextDocumentPositionParams, SymbolLocator, void, void>('textDocument/edefinition');
    export type HandlerSignature = RequestHandler<TextDocumentPositionParams, SymbolLocator | null, void>;
}

export namespace FullRequest {
    export const type = new RequestType<FullParams, Full, void, void>('textDocument/full');
    export type HandlerSignature = RequestHandler<FullParams, Full | null, void>;
}