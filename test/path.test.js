const { Path } = require("../src/path")

test("start", () => {
    let path = new Path("[[page]]/path")
    expect(path.start.lexeme).toBe("[[page]]")
    expect(path.start.type).toBe(Path.START_TYPE.PAGE)
    expect((new Path("((oybiI1KFK))/path")).start.lexeme).toBe("((oybiI1KFK))")
    expect((new Path("~/path")).start.lexeme).toBe("~")
    expect((new Path("./path")).start.lexeme).toBe(".")
    expect((new Path("_/path")).start.lexeme).toBe("_")
    expect((new Path("_/path")).start.type).toBe(Path.START_TYPE.FOCUSED)
    expect((new Path("path")).start.lexeme).toBe("")
    expect((new Path("path")).start.type).toBe(Path.START_TYPE.FOCUSED)
})

test("path", () => {
    expect((new Path("~/path/to")).path).toEqual(["path", "to"])
    expect((new Path("path/to")).path).toEqual(["path", "to"])
    expect((new Path("~/path/to/^$")).path).toEqual(["path", "to"])
})


test("offset", () => {
    s = new Path("~/path/to/block/^$/[2]")
    expect(s.offset[0].type).toEqual(Path.OFFSET_TYPE.CHILD)
    expect(s.offset[0].value).toEqual(0)
    expect(s.offset[1].type).toEqual(Path.OFFSET_TYPE.SIBLING)
    expect(s.offset[1].value).toEqual(-1)
    expect(s.offset[2].type).toEqual(Path.OFFSET_TYPE.SIBLING)
    expect(s.offset[2].value).toEqual(1)
    expect(s.offset[3].type).toEqual(Path.OFFSET_TYPE.CHILD)
    expect(s.offset[3].value).toEqual(2)
})