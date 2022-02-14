let { isBlockRef, isPageRef, getPageRefAtIndex } = require("./str") 
// let { Block, Page, Location } = require("./graph") 

ROOT_CHAR = "~"
PARENT_CHAR = "."
FOCUSED_CHAR = "_"

var START_TYPE_LIST = ["ROOT", "PARENT", "PAGE", "BLOCK", "FOCUSED"]
var START_TYPE = {}
START_TYPE_LIST.forEach(type => START_TYPE[type] = type)

var OFFSET_TYPE_LIST = ["SIBLING", "CHILD"]
var OFFSET_TYPE = {}
OFFSET_TYPE_LIST.forEach(type => OFFSET_TYPE[type] = type)


function Token(type, lexeme, value=null, index=null) {
    this.type = type
    this.lexeme = lexeme
    this.value = value
    this.index = index
}


function Selector(string) {
    this.string = string;
    let parser = new SelectorParser(string)
    let [start, path, offset] = parser.parse()
    this.start = start;
    this.path = path;
    this.offset = offset;
}
Selector.START_TYPE = START_TYPE 
Selector.OFFSET_TYPE = OFFSET_TYPE 
Selector.prototype = {
    ...Selector.prototype,
    split: function() {
        return [ this.start.lexeme ].concat(path) + this.offset.map(o => o.lexeme).join("")
    },
    // evaluate: function() {
    //     interpreter = new SelectorInterpreter(this)
    //     return interpreter.evaluate()
    // }
}


function SelectorParser(string) {
    this.string = string;
    this.current = 0;
    this.end = this.string.length;
    this.start;
    this.offset = [];
    this.path = [];
}
SelectorParser.prototype = {
    ...SelectorParser.prototype,
    parse: function() {
        this.consumeOffset()
        this.consumeRootAndPath()
        return [this.start, this.path, this.offset]
    },
    consumeOffset: function() {
        while (!this.isAtEnd()) {
            if (this.endIs("^")) {
                token = new Token(OFFSET_TYPE.SIBLING, this.consumeCharEnd(), -1, this.end)
            } else if (this.endIs("$")) {
                token = new Token(OFFSET_TYPE.SIBLING, this.consumeCharEnd(), 1, this.end)
            } else if (offset = this.endMatches(/\/(?:\[(\d+)\])?$/)) {
                let char = this.consumeCharEnd(offset[0].length)
                let value = parseInt(offset[1] || 0)
                token = new Token(OFFSET_TYPE.CHILD, char, value, this.end)
            } else {
                break
            }
            this.offset.push(token)
        }
        this.offset.reverse()
    },
    consumeRootAndPath: function() {
        var strings = this.split()
        var first = strings[0] || ""
        if (isPageRef(first)) {
            this.start = new Token(START_TYPE.PAGE, first, first)
            this.path = strings.slice(1)
        } else if (isBlockRef(first)) {
            this.start = new Token(START_TYPE.BLOCK, first, first)
            this.path = strings.slice(1)
        } else if (first === PARENT_CHAR.repeat(first.length)) {
            this.start = new Token(START_TYPE.PARENT, first, first)
            this.path = strings.slice(1)
        } else if (first === ROOT_CHAR) {
            this.start = new Token(START_TYPE.ROOT, first, first)
            this.path = strings.slice(1)
        } else if (first === FOCUSED_CHAR) {
            this.start = new Token(START_TYPE.FOCUSED, first, first)
            this.path = strings.slice(1)
        } else {
            this.start = new Token(START_TYPE.FOCUSED, "", first)
            this.path = strings
        }
    },
    split: function() {
        let strings = []
        while (!this.isAtEnd()) {
            strings.push(this.consumeUpToSep())
        } 
        return strings
    },
    consumeUpToSep: function() {
        let string = ""
        while (!this.nextIs("/") && !this.isAtEnd()) {
            string += this.consumePageRef() || this.consumeChar()
        }
        this.consumeChar()
        return string
    },
    consumePageRef: function() {
        pageRef = getPageRefAtIndex(this.string, this.current)
        if (pageRef) {
            this.current += pageRef.length
            return pageRef
        }
        return null
    },
    consumeChar: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        this.current += i
        return this.string.slice(this.current - i, this.current)
    },
    consumeCharEnd: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        this.end -= i
        return this.string.slice(this.end, this.end + i)
    },
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    endIs: function(string) {
        return string === this.string.slice(this.end - string.length, this.end)
    },
    endMatches: function(regex) {
        return this.string.slice(0, this.end).match(regex)
    },
    isAtEnd: function() {
        return this.current >= this.end
    },
}



module.exports = { Selector }