import { codeSelect, getOffsetOfLineAndCharacter } from "./utils";

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
