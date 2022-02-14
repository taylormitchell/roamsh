const { Selector, OFFSET_TYPE, START_TYPE } = require("../src/selector")

test("start", () => {
    let selector = new Selector("[[page]]/path")
    expect(selector.start.lexeme).toBe("[[page]]")
    expect(selector.start.type).toBe(START_TYPE.PAGE)
    expect((new Selector("((oybiI1KFK))/path")).start.lexeme).toBe("((oybiI1KFK))")
    expect((new Selector("~/path")).start.lexeme).toBe("~")
    expect((new Selector("./path")).start.lexeme).toBe(".")
    expect((new Selector("_/path")).start.lexeme).toBe("_")
    expect((new Selector("_/path")).start.type).toBe(START_TYPE.FOCUSED)
    expect((new Selector("path")).start.lexeme).toBe("")
    expect((new Selector("path")).start.type).toBe(START_TYPE.FOCUSED)
})

test("path", () => {
    expect((new Selector("~/path/to")).path).toEqual(["path", "to"])
    expect((new Selector("path/to")).path).toEqual(["path", "to"])
    expect((new Selector("~/path/to/^$")).path).toEqual(["path", "to"])
})


test("offset", () => {
    s = new Selector("~/path/to/block/^$/[2]")
    expect(s.offset[0].type).toEqual(OFFSET_TYPE.CHILD)
    expect(s.offset[0].value).toEqual(0)
    expect(s.offset[1].type).toEqual(OFFSET_TYPE.SIBLING)
    expect(s.offset[1].value).toEqual(-1)
    expect(s.offset[2].type).toEqual(OFFSET_TYPE.SIBLING)
    expect(s.offset[2].value).toEqual(1)
    expect(s.offset[3].type).toEqual(OFFSET_TYPE.CHILD)
    expect(s.offset[3].value).toEqual(2)
})