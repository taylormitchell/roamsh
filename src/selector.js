let { isBlockRef, isPageRef, getPageRefAtIndex } = require("./str") 

ROOT_CHAR = "~"
PARENT_CHAR = "."
FOCUSED_CHAR = "_"

function Selector(string) {
    this.string = string;
    let parser = new SelectorParser(string)
    let [root, path, offset] = parser.parse()
    this.root = root;
    this.path = path;
    this.offset = offset;
}
Selector.prototype = {
    ...Selector.prototype,
    split: function() {
        return [ this.root ].concat(path) + this.offset.join("")
    },
}

function SelectorParser(string) {
    this.string = string;
    this.current = 0;
    this.end = this.string.length;
    this.offset;
    this.root;
    this.path;
}
SelectorParser.prototype = {
    ...SelectorParser.prototype,
    parse: function() {
        this.consumeOffset()
        this.consumeRootAndPath()
        return [this.root, this.path, this.offset]
    },
    consumeOffset: function() {
        let offsets = []
        let pat = /((\/(\[\d+\])?)|\$|\^)$/
        let match = this.string.match(pat) 
        while (match !== null) {
            offsets.push(match[0])
            this.end = match.index
            match = this.string.slice(0, this.end).match(pat) 
        }
        offsets.reverse()
        this.offset = offsets
    },
    consumeRootAndPath: function() {
        strings = this.split()
        if (
            isPageRef(strings[0]) || 
            isBlockRef(strings[0]) ||
            strings[0] == ROOT_CHAR ||
            strings[0] == PARENT_CHAR ||
            strings[0] == FOCUSED_CHAR
        ) {
            this.root = strings[0]
            this.path = strings.slice(1)
        } else {
            this.root = FOCUSED_CHAR
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
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    isAtEnd: function() {
        return this.current >= this.end
    },
}

module.exports = { Selector }