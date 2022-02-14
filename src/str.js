

function Parser(string, current=0) {
    this.string = string
    this.current = current
    this.start = current 
}
Parser.prototype = {
    ...Parser.prototype,
    getNext: function() {
        while (!this.isAtEnd()) {
            res = this.consumeToken()
            if (res) return res
            this.consumeChar()
        }
        return null
    },
    getAll: function() {
        strings = []
        string = this.getNext()
        while (string) {
            strings.push(string)
            string = this.getNext()
        }
        return strings
    },
    consume: function() {
        return this.consumeToken() || this.consumeChar()
    },
    consumeToken: function() {
        throw new Error("consume not implemented")
    },
    consumeChar: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        if (this.isAtEnd()) return null
        this.current += i
        this.start = this.current
        return this.string.slice(this.current - i, this.current)
    },
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    peak: function() {
        return this.string[this.current]
    },
    isAtEnd: function() {
        return this.current >= this.string.length 
    },
    null: function() {
        this.current = this.start
        return null
    }
}

function PageRefParser(string, current=0) {
    Parser.call(this, string, current)
}
PageRefParser.prototype = Object.create(Parser.prototype)
PageRefParser.prototype.constructor = PageRefParser
PageRefParser.prototype.consumeToken = function() {
    let res = ""
    if (!this.nextIs("[[")) return this.null()
    res += this.consumeChar(2)

    while (!this.nextIs("]]") && !this.isAtEnd()) {
        res += this.consumeToken() || this.consumeChar()
    }

    if (!this.nextIs("]]")) return this.null()
    res += this.consumeChar(2)

    return res
}

function BlockRefParser(string, current=0) {
    Parser.call(this, string, current)
}
BlockRefParser.prototype = Object.create(Parser.prototype)
BlockRefParser.prototype.constructor = BlockRefParser
BlockRefParser.prototype.consumeToken = function() {
    this.start = this.current
    let block = ""

    if (!this.nextIs("((")) return this.null()
    block += this.consumeChar(2)

    while (!this.nextIs("))") && !this.isAtEnd()) {
        block += this.consumeChar()
    }

    if (!this.nextIs("))")) return this.null()
    block += this.consumeChar(2)

    return block
}


function matchPageRef(string, options={global: false}) {
    var parser = new PageRefParser(string)
    var pageRef = parser.getNext()
    if (pageRef) {
        let match = [ pageRef ];
        match.index = parser.current - pageRef.length;
        match.input = string;
        return match
    }
    return null
}

function getPageRefAtIndex(string, index=0) {
    let parser = new PageRefParser(string, current=index)
    return parser.consumeToken()
}

function isPageRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new PageRefParser(x)
    let res = parser.consumeToken()
    return res !== null && res.length === x.length
}

function isBlockRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new BlockRefParser(x)
    let res = parser.consumeToken()
    return res !== null && res.length === x.length
}

function isBlockUid(x) {
    return typeof (x) === "string" && (x.match(/^[\w\d\-_]{9}$/) !== null || x.match(/\d\d\-\d\d-\d\d\d\d/) !== null) // TODO: finish
}


module.exports = { isBlockRef, isPageRef, isBlockUid, getPageRefAtIndex, matchPageRef}