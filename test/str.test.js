let { isPageRef, isBlockRef, getPageRefAtIndex, matchPageRef} = require("../src/str.js") 


test("isPageRef", () => {
    expect(isPageRef("[[Page]]")).toBe(true);
    expect(isPageRef("[[Page [[in page]]]]")).toBe(true);
    expect(isPageRef("Text")).toBe(false);
    expect(isPageRef("Text and [[Page]]")).toBe(false);
})

test("isBlockRef", () => {
    expect(isBlockRef("((block-ref))")).toBe(true);
    expect(isBlockRef("Text")).toBe(false);
    expect(isBlockRef("Text and ((block-ref))")).toBe(false);
})

test("getPageRefAtIndex", () => {
    expect(getPageRefAtIndex("[[Page]]")).toBe("[[Page]]");
    expect(getPageRefAtIndex("later: [[Page]]", 7)).toBe("[[Page]]");
    expect(getPageRefAtIndex("later: [[Page]]", 0)).toBe(null);
})


test("matchPageRef", () => {
    input = "get [[this]]"
    output = ["[[this]]"]
    output.index = 4
    output.input = input
    expect(matchPageRef(input)).toEqual(output);

    input = "get [[this]], not [[that]]"
    output = ["[[this]]"]
    output.index = 4
    output.input = input
    expect(matchPageRef(input)).toEqual(output);
})

