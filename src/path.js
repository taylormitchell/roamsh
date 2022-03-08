let { PageRefParser, BlockRefParser, Parser, ParserError, Token } = require("./str") 
let { Location, NotFoundError } = require("./util")
let util = require("./util")

ROOT_CHAR = "~"
PARENT_CHAR = "."
FOCUSED_CHAR = "_"

let TOKEN_TYPES_LIST = [
    "PATH", "START_ROOT", "START_PARENT", "START_PAGE", "START_BLOCK", "START_FOCUSED",
    "STEP_TO_SIBLING_ABOVE", "STEP_TO_SIBLING_BELOW", "STEP_TO_CHILD", "STEP_TO_PARENT"]
TOKEN_TYPES_LIST.forEach(type => Token.TYPES[type] = type)

function Path(string) {
    this.string = string;
    let parser = new PathParser(string)
    let pathToken = parser.parse()
    let [start, ...steps] = pathToken.value
    this.start = start;
    this.steps = steps;
}
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

function PathParser(string, current = 0) {
    Parser.call(this, string, current)
    this.tokenType = Token.TYPES.PATH
}
PathParser.prototype = Object.create(Parser.prototype)
PathParser.prototype.constructor = PathParser
PathParser.prototype.parse = function() {
    if(this.current !== 0) {
        throw this.error(`Can only call parse from start of string, not: current = ${this.current}`)
    }
    let tokenStart = this.current;
    let tokens = []

    tokens.push(this.tokenizeStart())
    let stepStart = this.current;
    while (!this.isAtEnd()) {
        let step = this.tokenizeStep()
        if(!step) {
            throw this.error("Invalid step character", stepStart, this.current)
        }
        tokens.push(step)
    }
    return new Token(this.tokenType, this.string, tokens, tokenStart)
}
PathParser.prototype.tokenizeThis = function() {
    let tokenStart = this.current;

    // tokenize start and step tokens
    let tokens = []
    tokens.push(this.tokenizeStart())
    while (!this.isAtEnd()) {
        let step = this.tokenizeStep()
        if (!step) break
        tokens.push(step)
    }
    
    // Did we find an empty path?
    if(tokens[0].lexeme === "" && tokens.length <= 1) {
        // That's valid syntax if we're tokenizing a single path string 
        // but not if we're tokenizing a substring within a larger string
        if(this.string !== "") {
            this.current = tokenStart;
            return null
        }
    }
    let lexeme = this.string.slice(tokenStart, this.current);
    return new Token(this.tokenType, lexeme, tokens, tokenStart)
}
PathParser.prototype.tokenizeStart = function() {
    let tokenStart = this.current; 
    let string, token;
    if(string = this.advance(ROOT_CHAR)) {
        return new Token(Token.TYPES.START_ROOT, string, string, tokenStart) 
    } else if(string = this.advance(FOCUSED_CHAR)) {
        return new Token(Token.TYPES.START_FOCUSED, string, string, tokenStart) 
    } else if(token = this.tokenize(PageRefParser)) {
        return new Token(Token.TYPES.START_PAGE, token.lexeme, token, tokenStart) 
    } else if(token = this.tokenize(BlockRefParser)) {
        return new Token(Token.TYPES.START_BLOCK, token.lexeme, token, tokenStart) 
    } else {
        return new Token(Token.TYPES.START_FOCUSED, "", "", tokenStart) 
    }
}
PathParser.prototype.tokenizeStep = function() {
    let tokenStart = this.current;

    // Get step type
    let type;
    if (this.advance("^")) {
        type = Token.TYPES.STEP_TO_SIBLING_ABOVE
    } else if (this.advance("$")) {
        type = Token.TYPES.STEP_TO_SIBLING_BELOW 
    } else if (this.advance("/")) {
        type = Token.TYPES.STEP_TO_CHILD 
    } else if (this.advance(".")) {
        type = Token.TYPES.STEP_TO_PARENT 
    } else {
        return null;
    }
    // Get step selector string
    let token;
    let stepSelector = "";
    while (!this.isAtEnd()) {
        let escapedChar = this.escape()
        if(escapedChar !== null) {
            stepSelector += escapedChar
        } else if(token = this.tokenize(PageRefParser)) {
            stepSelector += token.lexeme
        } else if(this.check("^", "$", "/", ".")) {
            break
        } else {
            stepSelector += this.advance(1)
        }
    }

    // Create step token
    let lexeme = this.string.slice(tokenStart, this.current);
    let value;
    let match = stepSelector.match(/\[([1-9]*\d)\]/)
    if(!stepSelector) {
        value = 0;
    } else if(match) {
        value = parseInt(match[1]);
    } else {
        value = stepSelector;
    }
    return new Token(type, lexeme, value, tokenStart)
}
PathParser.prototype.escape = function() {
    if(!this.advance('\\')) {
        return null;
    }
    if(this.isAtEnd()) {
        return '\\'
    }
    return this.advance()
}

PathParser.prototype.error = function(message, stepIndex, errorIndex, errorLength) {
    if (stepIndex && errorIndex) {
        errorLength = errorLength || 1
        lines = []
        lines.push(message)
        lines.push("")
        lines.push(`Start: "${this.string.slice(0, stepIndex)}"`)
        lines.push(`Steps: "${this.string.slice(stepIndex)}"`)
        lines.push(`        ${" ".repeat(errorIndex - stepIndex) + "^".repeat(errorLength)}`)
        message = lines.join("\n")
    }
    return new ParserError(message)
}

function PathInterpreter(path) {
    if (!(path instanceof Path)) {
        path = new Path(path)
    }
    this.path = path
    this.current;
}
PathInterpreter.prototype.error = function(message, token) {
    if (token) {
        string = this.path.string
        pointer = " ".repeat(token.index) + "^".repeat(token.lexeme.length)
        message += "\n\n" + string + "\n" + pointer
    }
    throw new NotFoundError(message)
}
PathInterpreter.prototype.evaluate = function() {
    // Go to start
    let current = this.start(this.path.start) 
    // Follow steps
    for (let token of this.path.steps) {
        current = this.step(current, token)
    }
    return current
}
PathInterpreter.prototype.start = function(token) {
    if(token.type === Token.TYPES.START_ROOT) {
        throw new NotFoundError(`No support for paths starting at ${path.start} yet :(`);
    } else if(token.type === Token.TYPES.START_FOCUSED) {
        return util.getFocused()
    } else if(token.type === Token.TYPES.START_PAGE) {
        return this.page(token.value)
    } else if(token.type === Token.TYPES.START_BLOCK) {
        return this.block(token.value)
    }
    this.error("Invalid path start", token)
}
PathInterpreter.prototype.step = function(current, token) {
    if (current instanceof Location) {
        this.error("Can't apply step once path reaches a new location", token)
    }
    if(token.type === Token.TYPES.STEP_TO_CHILD) {
        return this.stepToChild(current, token)
    } else if (token.type === Token.TYPES.STEP_TO_PARENT) {
        return this.stepToParent(current, token)
    } else if (token.type === Token.TYPES.STEP_TO_SIBLING_ABOVE ||
               token.type === Token.TYPES.STEP_TO_SIBLING_BELOW) {
        return this.stepToSibling(current, token)
    } else {
        throw `Invalid step type: ${token.type}`
    }
}
PathInterpreter.prototype.page = function(pageToken) {
    let title = pageToken.value.map(token => token.lexeme).join("")
    return util.getByTitle(title)
}
PathInterpreter.prototype.block = function(blockToken) {
    let uid = blockToken.value[0].lexeme
    return util.getByUid(uid)
}
PathInterpreter.prototype.stepToChild = function(block, token) {
    let children = util.getChildren(block)
    // Handle indexer
    if(typeof(token.value) === 'number') {
        let childNum = token.value
        if (children.length === 0) {
            if (childNum >= 1) {
                this.error('Child path index must be <=0 when node has no children', token);
            } else {
                return new Location(block[":block/uid"], 0)
            }
        } else if (childNum < 0) {
            return children.slice(childNum)[0]
        } else if (childNum < children.length) {
            return children[childNum]
        } else {
            return new Location(util.getParent(block)[":block/uid"], children.length)
        }
    // Handle search string
    } else {
        let matchedChildren = children.filter(child => child[":block/string"] === token.value)
        if (matchedChildren.length === 0) {
            this.error("No children matching search string", token)
        }
        return matchedChildren[0]
    }
}
PathInterpreter.prototype.stepToParent = function(block, token) {
    let parents = util.getParents(block).reverse()
    // Handle indexer
    if(typeof(token.value) === 'number') {
        let parentNum = token.value
        if (parentNum < 0) {
            return parents.slice(parentNum)[0]
        } else {
            return parents[parentNum]
        }
    // Handle search string
    } else {
        let matchedParents = parents.filter(parent => (parent[":block/string"] || parent[":node/title"]) === token.value)
        if (matchedParents.length === 0) {
            this.error("No parents matching search string", token)
        }
        return matchedParents[0]
    }
}
PathInterpreter.prototype.stepToSibling = function(block, token) {
    if (util.isPage(block)) {
        this.error("Can't select a sibling of a Page", token)
    }
    let siblings = util.getSiblings(block)
    currentOrder = block[":block/order"]
    // Handle indexer
    if(typeof(token.value) === 'number') {
        let order;
        if(token.type === Token.TYPES.STEP_TO_SIBLING_ABOVE) {
            order = currentOrder - (token.value + 1)
        } else {
            order = currentOrder + (token.value + 1)
        }
        if (order < 0) {
            return new Location(util.getParent(block)[":block/uid"], 0)
        } else if (order < siblings.length) {
            return siblings[order]
        } else if (order >= siblings.length) {
            return new Location(util.getParent(block)[":block/uid"], siblings.length)
        }    
    // Handle search string
    } else {
        if(token.type === Token.TYPES.STEP_TO_SIBLING_ABOVE) {
            siblings = siblings.slice(0, currentOrder).reverse()
        } else {
            siblings = siblings.slice(currentOrder + 1)
        }
        let matchedSiblings = siblings.filter(sibling => sibling[":block/string"] === token.value)
        if (matchedSiblings.length === 0) {
            this.error("No siblings matching search string", token)
        }
        return matchedSiblings[0]
    }
}



function pathToLocation(path) {
    if(typeof(path) === 'string') {
        path = new Path(path)
    }
    if(!(path instanceof Path)) {
        throw new Error(`Argument must be a Path or path string.`)
    }
    let res = path.evaluate()
    // res will be a Location or uid string
    if(res instanceof Location) {
        return res
    } else {
        let uid = res
        return new Location(util.getParent(uid), util.getOrder(uid))
    }
}

module.exports = { Path, PathParser, pathToLocation }