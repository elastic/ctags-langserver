import * as fs from 'mz/fs';
import * as path from 'path';
import minimatch from 'minimatch';
// @ts-ignore
import LineColumnFinder from 'line-column';
import { DocumentSymbol, SymbolInformation } from 'vscode-languageserver';

const WORD_CHAR: RegExp = /(\w)/;

export function getOffsetOfLineAndCharacter(sourceFile: string, line: number, character: number): number {
    return LineColumnFinder(sourceFile).toIndex(line, character);
}

export function codeSelect(source: string, offset: number): string {
    let start = offset;
    let end = offset;
    while (WORD_CHAR.test(source.charAt(start--))) {; }
    while (WORD_CHAR.test(source.charAt(end++))) {; }
    return source.substring(start + 2, end - 1);
}

export function bestIndexOfSymbol(wholeStr: string, symbol: string): number {
    if (wholeStr.length < 1) {
        return 0;
    } else {
        let woff = strictIndexOf(wholeStr, symbol);
        if (woff >= 0) {
            return woff;
        } else {
          woff = wholeStr.indexOf(symbol);
          return woff;
        }
    }
}

export function cutLineText(origin: string): string {
    // /^${line text}$/;"
    return origin.substring(2, origin.length - 2);
}

function strictIndexOf(wholeStr: string, subStr: string): number {
    let strictLeft: boolean = subStr.length > 0 && WORD_CHAR.test(subStr.charAt(0));
    let strictRight: boolean = subStr.length > 0 && WORD_CHAR.test(subStr.charAt(subStr.length - 1));

    let spos = 0;
    do {
        let woff = wholeStr.indexOf(subStr, spos);
        if (woff < 0) {
            return -1;
        }

        spos = woff + 1;
        if (strictLeft && woff > 0) {
            if (WORD_CHAR.test(wholeStr.charAt(woff - 1))) {
                continue;
            }
        }
        if (strictRight && (woff + subStr.length) < wholeStr.length) {
            if (WORD_CHAR.test(wholeStr.charAt(woff + subStr.length))) {
                continue;
            }
        }
        return woff;
    } while (spos < wholeStr.length);
    return -1;
}

export async function grep(symbolName: string, root: string, include: string, limit?: number): Promise<Match[]> {
    let matchNumber = 0;
    const match: Match[] = [];
    const files = await fs.readdir(root);
    for (const file of files) {
        const child = path.resolve(root, file);
        const stat = await fs.stat(child);
        if (stat.isDirectory()) {
            let childMatch: Match[];
            if (limit) {
                childMatch = await grep(symbolName, child, include, limit - matchNumber);
            } else {
                childMatch = await grep(symbolName, child, include);
            }
            matchNumber += match.push(...childMatch);
        } else if (minimatch(file, include)) {
            let lineNum: number = 0;
            const contents = fs.readFileSync(child, 'utf8');
            const r = new RegExp(symbolName);
            for (const line of contents.split('\n')) {
                if (limit && matchNumber > limit) {
                    break;
                }
                if (r.test(line)) {
                    match.push({
                        path: child,
                        text: line,
                        line: lineNum
                    });
                    matchNumber ++;
                }
                lineNum ++;
            }
        }
    }
    return match;
}

interface DocumentSymbolWithParent extends DocumentSymbol {
    parent?: string
}

export async function toHierarchicalDocumentSymbol(flattenedSymbolInformation: SymbolInformation[], sourceFile: string): Promise<DocumentSymbol[]> {
    let map = new Map();
    let roots: DocumentSymbol[] = [];
    let tmpResult: DocumentSymbolWithParent[] = [];
    let i = 0;
    flattenedSymbolInformation.forEach(symbol => {
        const documentSymbolwithParent: DocumentSymbolWithParent = {
            name: symbol.containerName === sourceFile ? symbol.name : `${symbol.containerName}.${symbol.name}`,
            kind: symbol.kind,
            range: symbol.location.range,
            selectionRange: symbol.location.range,
            children: [],
            parent: symbol.containerName
        }
        map.set(documentSymbolwithParent.name, i ++);
        tmpResult.push(documentSymbolwithParent);
    });
    tmpResult.forEach(symbol => {
        if (symbol.parent !== sourceFile) {
            tmpResult[map.get(symbol.parent)].children.push(symbol);
        } else {
            roots.push(symbol);
        }
        delete symbol.parent;
    });
    return roots;
}

interface Match {
    path: string;
    text: string;
    line: number;
}
