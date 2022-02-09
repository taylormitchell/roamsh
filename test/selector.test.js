const { Selector } = require("../src/selector")

test("root", () => {
    expect((new Selector("[[page]]/path")).root).toBe("[[page]]")
    expect((new Selector("((oybiI1KFK))/path")).root).toBe("((oybiI1KFK))")
    expect((new Selector("~/path")).root).toBe("~")
    expect((new Selector("./path")).root).toBe(".")
    expect((new Selector("_/path")).root).toBe("_")
    expect((new Selector("path")).root).toBe("_")
})

test("path", () => {
    expect((new Selector("~/path/to")).path).toEqual(["path", "to"])
    expect((new Selector("path/to")).path).toEqual(["path", "to"])
    expect((new Selector("~/path/to/^$")).path).toEqual(["path", "to"])
})


test("offset", () => {
    s = new Selector("~/path/to/block/^$/[2]")
    expect(s.offset).toEqual(["/", "^", "$", "/[2]"])
})