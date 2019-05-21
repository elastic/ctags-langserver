import { Command } from 'commander';
import { createLspConnection } from './lsp-connection';
import * as lsp from 'vscode-languageserver';

const program = new Command('ctags-language-server')
    .version(require('../package.json').version)
    .option('--stdio', 'use stdio')
    .option('--node-ipc', 'use node-ipc')
    .option('--log-level <logLevel>', 'A number indicating the log level (4 = log, 3 = info, 2 = warn, 1 = error). Defaults to `2`.')
    .option('--socket <port>', 'use socket. example: --socket=5000')
    .option('--ctags-path <path>', `Specify path to ctags. example: --ctags-path=${getCtagsExecutable()}`)
    .parse(process.argv);

let logLevel = lsp.MessageType.Warning
if (program.logLevel) {
    logLevel = parseInt(program.logLevel, 10);
    if (logLevel && (logLevel < 1 || logLevel > 4)) {
        console.error('Invalid `--log-level ' + logLevel + '`. Falling back to `info` level.');
        logLevel = lsp.MessageType.Warning;
    }
}

createLspConnection({
    ctagsPath: program.ctagsPath as string,
    showMessageLevel: logLevel as lsp.MessageType
}).listen();


function getCtagsExecutable(): string {
    return 'ctags'
}