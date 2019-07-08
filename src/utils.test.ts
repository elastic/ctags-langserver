import { codeSelect, getOffsetOfLineAndCharacter, bestIndexOfSymbol, cutLineText, grep } from "./utils";
import * as fs from 'fs';
import * as path from 'path';

const content = "int max(int foo, int bar)\n" +
                    "{\n" +
                    "   int result;\n" +
                    " if (foo > bar)\n" +
                    "   result = foo;\n" +
                    " else\n" +
                    "   result = bar;\n" +
                    " return result;\n" +
                    "}"

test("test get offset according to line number and character number", () => {
    let offset = getOffsetOfLineAndCharacter(content, 3, 4);
    expect(offset).toEqual(31);
    offset = getOffsetOfLineAndCharacter(content, 100, 4);
    expect(offset).toEqual(-1);
});

test("test code select", () => {
    let symbol = codeSelect(content, 1);
    expect(symbol).toEqual('int');
    symbol = codeSelect(content, 1000);
    expect(symbol).toEqual('');
    symbol = codeSelect(content, -1);
    expect(symbol).toEqual('');
});

test("test best index of symbol in a line", () => {
    const origin = 'hello_suffix prefix_hello hello, world!';
    const index = bestIndexOfSymbol(origin, 'hello');
    expect(index).toEqual(26);
});

test("test remove unnecessary parts in hover text", () => {
    const before = '/^#define ASSERT_STREQ(/;';
    const after = cutLineText(before);
    expect(after).toEqual('#define ASSERT_STREQ(');
});

test("test grep", async () => {
    const rootPath = fs.mkdtempSync('/tmp/ctags-langserver');
    const sourceFilePath = path.resolve(rootPath, 'test.c');
    const dir1Path = path.resolve(rootPath, 'dir1');
    fs.mkdirSync(dir1Path);
    const dir1SourcePath = path.resolve(dir1Path, 'test.c');
    fs.writeFileSync(sourceFilePath, content);
    fs.writeFileSync(dir1SourcePath, content);
    const match = await grep('return', rootPath, '*.c');
    expect(match).toEqual([{
        path: dir1SourcePath,
        text: ' return result;',
        line: 7
    },
    {
        path: sourceFilePath,
        text: ' return result;',
        line: 7
    }])
});
