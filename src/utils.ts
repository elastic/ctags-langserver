import * as lineColumn from 'line-column';

export function getOffsetOfLineAndCharacter(sourceFile: string, line: number, character: number): number {
    return lineColumn(sourceFile).toIndex(line, character);
}

export function codeSelect(source: string, offset: number): string {
    let start = offset;
    let end = offset;
    while (accept(source.charCodeAt(start--))) {; }
    while (accept(source.charCodeAt(end++))) {; }
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
    return origin.substring(2, origin.length-2);
}

function strictIndexOf(wholeStr: string, subStr: string): number {
    let WORD_CHAR: RegExp = /(\w)/;

    let stricLeft: boolean = subStr.length > 0 && WORD_CHAR.test(subStr.charAt(0));
    let strictRight: boolean = subStr.length > 0 && WORD_CHAR.test(subStr.charAt(subStr.length - 1));

    let spos = 0;
    do {
        let woff = wholeStr.indexOf(subStr, spos);
        if (woff < 0) {
            return -1;
        }

        spos = woff + 1;
        if (stricLeft && woff > 0) {
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

function accept(charCode: number): boolean {
    if ((charCode > 47 && charCode < 58) || // 0-9
        (charCode > 64 && charCode < 91) || // A-Z
        (charCode > 96 && charCode < 123) || // a-z
        (charCode === 95) || // _
        (charCode === 36)) { // $
            return true;
        }
    return false;
}