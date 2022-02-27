const { Path, PathParser } = require("../src/path")


test("handleEmptyString", () => {
    let parser = new PathParser("")
    let path = parser.parse()
    expect(path.type).toEqual(path.constructor.TYPES.PATH)
    expect(path.lexeme).toEqual("")

    parser = new PathParser("")
    paths = parser.parseMany()
    expect(paths).toEqual([])
})

test('invalidStep', () => {
    expect(() => new Path("[[page]]x")).toThrow()
    expect(new Path("[[page]]^")).toBeInstanceOf(Path)
})

test('mustParseFromStart', () => {
    let parser = new PathParser("[[page]]")
    parser.advance(1)
    expect(() => parser.parse()).toThrow()
})

test("start", () => {
    let path;
    for(let pathString of ["[[page]]", "[[page]]/path"]) {
        path = new Path(pathString)
        expect(path.start.lexeme).toBe("[[page]]")
        expect(path.start.type).toBe(path.start.constructor.TYPES.START_PAGE)
    }
    path = new Path("((oybiI1KFK))/path")
    expect(path.start.lexeme).toBe("((oybiI1KFK))")
    expect(path.start.type).toBe(path.start.constructor.TYPES.START_BLOCK)
    expect((new Path("~/path")).start.lexeme).toBe("~")
    expect((new Path("_/path")).start.lexeme).toBe("_")
    expect((new Path("_/path")).start.type).toBe(path.start.constructor.TYPES.START_FOCUSED)
    expect((new Path("/path")).start.lexeme).toBe("")
    expect((new Path("/path")).start.type).toBe(path.start.constructor.TYPES.START_FOCUSED)
})

test("step", () => {
    let p = new Path("~/path/to^block$/[2]")
    expect(p.steps[0].type).toEqual(p.steps[0].constructor.TYPES.STEP_TO_CHILD)
    expect(p.steps[0].value).toEqual("path")
    expect(p.steps[1].type).toEqual(p.steps[1].constructor.TYPES.STEP_TO_CHILD)
    expect(p.steps[1].value).toEqual("to")
    expect(p.steps[2].type).toEqual(p.steps[2].constructor.TYPES.STEP_TO_SIBLING_ABOVE)
    expect(p.steps[2].value).toEqual("block")
    expect(p.steps[3].type).toEqual(p.steps[3].constructor.TYPES.STEP_TO_SIBLING_BELOW)
    expect(p.steps[3].value).toEqual(0)
    expect(p.steps[4].type).toEqual(p.steps[4].constructor.TYPES.STEP_TO_CHILD)
    expect(p.steps[4].value).toEqual(2)
})

test("tokenizeThis", () => {
    let startString = "[[Page]]"
    let stepString = "/[2]"
    let string = startString + stepString
    let parser = new PathParser(string, 0)
    let token = parser.tokenizeThis()
    expect(token.lexeme).toEqual(string)

    string = "[[Page]]/to/child^then^sib$/[0]"
    parser = new PathParser(string, 0)
    token = parser.tokenizeThis()
    expect(token.lexeme).toEqual(string)

    string = "something then " + startString + stepString
    parser = new PathParser(string, 0)
    token = parser.tokenizeThis()
    expect(token).toBe(null)
})

test("tokenizeStart", () => {
    let startString = "[[Page]]"
    let stepString = "/[2]"
    let string = startString + stepString
    let parser = new PathParser(string, 0)
    let start = parser.tokenizeStart()
    expect(start.lexeme).toEqual(startString)
})

test("tokenizeStep", () => {
    let startString = "[[Page]]"
    let stepString = "/[2]"
    let string = startString + stepString
    let parser = new PathParser(string, startString.length)
    let step = parser.tokenizeStep()
    expect(step.value).toEqual(2)
    expect(step.lexeme).toEqual(stepString)
})
