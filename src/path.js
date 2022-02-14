let { isBlockRef, isPageRef, getPageRefAtIndex } = require("./str") 
let { Block, Page, Location } = require("./core") 

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


function Path(string) {
    this.string = string;
    let parser = new PathParser(string)
    let [start, path, offset] = parser.parse()
    this.start = start;
    this.path = path;
    this.offset = offset;
}
Path.START_TYPE = START_TYPE 
Path.OFFSET_TYPE = OFFSET_TYPE 
Path.prototype = {
    ...Path.prototype,
    split: function() {
        return [ this.start.lexeme ].concat(path) + this.offset.map(o => o.lexeme).join("")
    },
    evaluate: function() {
        interpreter = new PathInterpreter(this)
        return interpreter.evaluate()
    }
}


function PathParser(string) {
    this.string = string;
    this.current = 0;
    this.end = this.string.length;
    this.start;
    this.offset = [];
    this.path = [];
}
PathParser.prototype = {
    ...PathParser.prototype,
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


function LocationNotFound(message) {
    instance = new Error(message);
    instance.name = 'LocationNotFound';
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) {
        Error.captureStackTrace(instance, LocationNotFound);
      }
    return instance;
}
LocationNotFound.prototype = Object.create(Error.prototype)
LocationNotFound.prototype.constructor = LocationNotFound


function PathInterpreter(path) {
    if (!(path instanceof Path)) {
        path = new Path(path)
    }
    this.path = path
}
PathInterpreter.prototype.error = function(message, token) {
    if (token) {
        string = this.path.string
        pointer = " ".repeat(token.index) + "^".repeat(token.lexeme.length)
        message += "\n\n" + string + "\n" + pointer
    }
    throw LocationNotFound(message)
}
PathInterpreter.prototype.evaluate = function() {
    // Get starting object
    var node;
    switch (this.path.start.type) {
        case Path.START_TYPE.ROOT:
            throw new LocationNotFound(`No support for paths starting at ${path.start} yet :(`);
        case Path.START_TYPE.PARENT:
            node = Block.getFocused()
            for (var i = 0; i < this.path.start.length; i++) {
                node = block.getParent();
            }
            break;
        case Path.START_TYPE.FOCUSED:
            node = Block.getFocused();
            break;
        case Path.START_TYPE.PAGE:
            node = new Page(this.path.start.lexeme);
            break;
        case Path.START_TYPE.BLOCK:
            node = new Block(this.path.start.lexeme);
            break;
        default:
            throw new LocationNotFound(`Invalid path start: ${this.path.start}`);
    }

    // Traverse path
    for (var searchString of this.path.path) {
        let res = node.getChildren().filter(({ string }) => string === searchString)
        if (res.length === 0) {
            throw new LocationNotFound(`"${searchString}" doesn't match any children of ${node.uid}`)
        }
        node = res[0]
    }

    // Traverse offset
    var location;
    for (var offset of this.path.offset) {
        if (location) {
            throw `Can't apply offset once path reaches `+
                  `new location: ${offset.lexeme} at index ${offset.index}`
        }
        switch (offset.type) {
            case Path.OFFSET_TYPE.SIBLING:
                if (node instanceof Page) {
                    this.error("Can't select a sibling of a Page", offset)
                }
                let order = node.getOrder() + offset.value
                let siblings = node.getSiblings()
                if (order < 0) {
                    location = new Location(node.getParent().uid, 0)
                } else if (order < siblings.length) {
                    node = siblings[order]
                } else if (order >= siblings.length) {
                    location = new Location(node.getParent().uid, siblings.length)
                }    
                break;
            case Path.OFFSET_TYPE.CHILD:
                let childNum = offset.value
                let children = node.getChildren()
                if (children.length === 0) {
                    if (childNum >= 1) {
                        this.error('Child path index must be <=0 when node has no children', token);
                    } else {
                        location = new Location(node.uid, 0)
                    }
                } else if (childNum < 0) {
                    node = children.slice(childNum)[0]
                } else if (childNum < children.length) {
                    node = children[childNum]
                } else {
                    location = new Location(node.getParent().uid, children.length)
                }
                break;
            default:
                throw `Invalid offset type: ${offsetToken.type}`
        }
    }

    return location || node
}


module.exports = { Path }