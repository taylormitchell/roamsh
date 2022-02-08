const { RoamResearchShell, Scanner, Parser } = require('../rrsh');


function test() {
    // Test Parser.pageRef
    // base case
    var source = "[[Page]]"
    tokens = (new Scanner(source)).scanTokens()
    parser = new Parser(tokens)
    pageRef = parser.pageRef()
    "Page".split("").forEach((expected, i) => {
        let actual = pageRef.expressions[i].value;
        if (expected !== actual) {
            throw `Expected ${expected} !== Actual ${actual} `
        }
    })
    // missing closing brackets
    var source = "[[Page"
    tokens = (new Scanner(source)).scanTokens()
    parser = new Parser(tokens)
    pageRef = parser.pageRef()
    if (pageRef !== false) throw `${pageRef} !== false`
    if (parser.current !== 0) throw `${parser.current} !== 0`
    // page in page
    var source = "[[Page [[in page]]]]"
    tokens = (new Scanner(source)).scanTokens()
    parser = new Parser(tokens)
    pageRef = parser.pageRef()

    console.log("All tests passed!")
}

test()
