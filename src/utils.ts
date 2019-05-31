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