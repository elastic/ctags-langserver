import { LspClient } from './lsp-client';
import * as lsp from 'vscode-languageserver';

/**
 * the logger type
 */
export interface Logger {
    error(...arg: any[]): void
    warn(...arg: any[]): void
    info(...arg: any[]): void
    log(...arg: any[]): void
}

export class LspClientLogger implements Logger {
    constructor(protected client: LspClient, protected level: lsp.MessageType) { }

    protected sendMessage(severity: lsp.MessageType, messageObjects: any[]): void {
        if (this.level >= severity) {
            let message = messageObjects.map( p => {
                if (typeof p === 'object') {
                    return JSON.stringify(p, null, 2)
                } else {
                    return p
                }
            }).join(' ');

            this.client.logMessage({
                type: severity,
                message: message
            })
        }
    }

    error(...arg: any[]): void {
        this.sendMessage(lsp.MessageType.Error, arg)
    }

    warn(...arg: any[]): void {
        this.sendMessage(lsp.MessageType.Warning, arg)
    }

    info(...arg: any[]): void {
        this.sendMessage(lsp.MessageType.Info, arg)
    }

    log(...arg: any[]): void {
        this.sendMessage(lsp.MessageType.Log, arg)
    }

}

export class ConsoleLogger implements Logger {

    constructor(private isLogEnabled?: boolean) {}

    // @ts-ignore
    private toStrings(...arg): string[] {
        return (arg.map(a => JSON.stringify(a, null, 2)));
    }
    // @ts-ignore
    error(...arg) {
        console.error(...this.toStrings(arg));
    }
    // @ts-ignore
    warn(...arg) {
        console.warn(...this.toStrings(arg));
    }
    // @ts-ignore
    info(...arg) {
        console.info(...this.toStrings(arg));
    }
    // @ts-ignore
    log(...arg) {
        if (this.isLogEnabled) {
            console.log(...this.toStrings(arg));
        }
    }
}

export class PrefixingLogger implements Logger {

    constructor(private logger: Logger, private prefix: string) { }

    error(...arg: any[]): void {
        this.logger.error(this.prefix, ...arg);
    }

    warn(...arg: any[]): void {
        this.logger.warn(this.prefix, ...arg);
    }

    info(...arg: any[]): void {
        this.logger.info(this.prefix, ...arg);
    }

    log(...arg: any[]): void {
        this.logger.log(this.prefix, ...arg);
    }
}