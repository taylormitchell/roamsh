let { isBlockRef, isPageRef, getPageRefAtIndex, PageRefParser, BlockRefParser, Parser, ParserError, Token } = require("./str") 
let { Block, Page, Location } = require("./core") 

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
    let stepSelector = "";
    while (!this.isAtEnd() && !this.check("^", "$", "/", ".")) {
        stepSelector += this.advance()
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
    // Go to start
    var node;
    switch (this.path.start.type) {
        case Token.TYPES.START_ROOT:
            throw new LocationNotFound(`No support for paths starting at ${path.start} yet :(`);
        case Token.TYPES.START_FOCUSED:
            node = Block.getFocused();
            break;
        case Token.TYPES.START_PAGE:
            node = new Page(this.path.start.lexeme);
            break;
        case Token.TYPES.START_BLOCK:
            node = new Block(this.path.start.lexeme);
            break;
        default:
            throw new LocationNotFound(`Invalid path start: ${this.path.start}`);
    }

    // Follow steps
    var location;
    for (let step of this.path.steps) {
        if (location) {
            throw `Can't apply step once path reaches a `+
                  `new location: ${step.lexeme} at index ${step.index}`
        }
        if(step.type === Token.TYPES.STEP_TO_CHILD) {
            let children = node.getChildren()
            if(typeof(step.value) === 'number') {
                let childNum = step.value
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
            } else {
                let matches = children.filter(child => child.getString() === step.value)
                if (matches.length === 0) {
                    throw new LocationNotFound(`"${step.value}" doesn't match any children of ${node.uid}`)
                }
                node = matches[0]
            }
        } else if (step.type === Token.TYPES.STEP_TO_PARENT) {
            let parents = node.getParents().reverse()
            if(typeof(step.value) === 'number') {
                let parentNum = step.value
                if (parentNum < 0) {
                    node = parents.slice(parentNum)[0]
                } else {
                    node = parents[parentNum]
                }
            } else {
                let matches = parents.filter(p => p.getString() === step.value)
                if (matches.length === 0) {
                    throw new LocationNotFound(`"${step.value}" doesn't match any parents of ${node.uid}`)
                }
                node = matches[0]
            }
        } else if (step.type === Token.TYPES.STEP_TO_SIBLING_ABOVE ||
                   step.type === Token.TYPES.STEP_TO_SIBLING_BELOW) {
            if (node instanceof Page) {
                this.error("Can't select a sibling of a Page", step)
            }

            let order;
            if(step.type === Token.TYPES.STEP_TO_SIBLING_ABOVE) {
                order = node.getOrder() - (step.value + 1)
            } else {
                order = node.getOrder() + (step.value + 1)
            }
            
            let siblings = node.getSiblings()
            if (order < 0) {
                location = new Location(node.getParent().uid, 0)
            } else if (order < siblings.length) {
                node = siblings[order]
            } else if (order >= siblings.length) {
                location = new Location(node.getParent().uid, siblings.length)
            }    
        } else {
            throw `Invalid step type: ${step.type}`
        }
    }

    return location || node
}

module.exports = { Path, PathParser }