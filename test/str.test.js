let { isPageRef, isBlockRef, PageRefParser, BlockRefParser, ParserError} = require("../src/str.js") 

test("PageRef missing opening brackets", () => {
    let parser = new PageRefParser("Page")
    expect(() => parser.parse()).toThrow(ParserError)
})

test("PageRef missing closing brackets", () => {
    let parser = new PageRefParser("[[Page")
    expect(() => parser.parse()).toThrow(ParserError)
})

test("PageRef ends in extra characters", () => {
    let parser = new PageRefParser("[[Page]]derp")
    expect(() => parser.parse()).toThrow(ParserError)
})

test("BlockRef missing opening brackets", () => {
    let parser = new BlockRefParser("block")
    expect(() => parser.parse()).toThrow(ParserError)
})

test("BlockRef missing closing brackets", () => {
    let parser = new BlockRefParser("((block-ref")
    expect(() => parser.parse()).toThrow(ParserError)
})

test("BlockRef ends in extra characters", () => {
    let parser = new BlockRefParser("((block))derp")
    expect(() => parser.parse()).toThrow(ParserError)
})

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


