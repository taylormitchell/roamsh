



function Token(type, lexeme, value=null, index=null) {
    this.type = type
    this.lexeme = lexeme
    this.value = value
    this.index = index
}
TOKEN_TYPE_LIST = ["PAGE_REF", "BLOCK_REF", "LITERAL"]
Token.TYPES = {}
TOKEN_TYPE_LIST.forEach(type => Token.TYPES[type] = type)


function ParserError(message) {
    instance = new Error(message);
    instance.name = 'ParserError';
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) {
        Error.captureStackTrace(instance, ParserError);
      }
    return instance;
}
ParserError.prototype = Object.create(Error.prototype)
ParserError.prototype.constructor = ParserError


function Parser(string, current=0) {
    if(typeof(string) !== 'string') {
        throw new TypeError(`The "string" argument must be a string. Received type ${typeof(string)} (${string})`) 
    }
    this.string = string
    this.current = current
    this.tokenType;
}
Parser.tokenType = null
Parser.prototype = {
    ...Parser.prototype,
    parse: function() {
        throw new Error("parse not implemented")
    },
    parseMany: function() {
        let tokens = []
        while (!this.isAtEnd()) {
            let token;
            if(token = this.tokenizeThis()) {
                tokens.push(token)
            } else {
                this.advance(1)
            }
        }
        return tokens
    },
    next: function() {
        let token;
        while(!this.isAtEnd()) {
            if(token = this.tokenizeThis()) {
                return token
            }
            this.advance(1)
        }
        return null;
    },
    tokenizeThis: function() {
        throw new Error("tokenizeThis not implemented")
    },
    tokenizeChar: function(n, tokens) {
        let tokenStart = this.current;
        let string = this.advance(n)
        if(tokens && tokens.length) {
            lastToken = tokens.slice(-1)[0]
            if(lastToken.type === Token.TYPES.LITERAL) {
                lastToken.lexeme += string
                lastToken.value += string
                return tokens.pop()
            }
        }
        let token = new Token(Token.TYPES.LITERAL, string, string, tokenStart)
        return token
    },
    tokenize: function(x) {
        let tokenStart = this.current;

        let token;
        if(!x) {
            if(token = this.tokenizeThis()) {
                return token
            } else {
                return this.tokenize(1)
            }
        } else if(typeof(x) === 'string') {
            if(this.advance(x)) {
                return new Token(Token.TYPES.LITERAL, x, x, tokenStart)
            }
        } else if(typeof(x) === 'number') {
            let string = this.advance(x)
            return new Token(Token.TYPES.LITERAL, string, string, tokenStart)
        } else if(x.prototype instanceof Parser) {
            let parser = new x(this.string, this.current)
            if(token = parser.tokenizeThis()) {
                this.current = parser.current
                return token
            }
        }
        return null
    },
    advance: function(x = 1) {
        if(typeof(x) === "number") {
            chars = this.string.slice(this.current, this.current + x)
            this.current += chars.length
            return chars
        } else if(typeof(x) === "string") {
            let chars = this.string.slice(this.current, this.current + x.length)
            if(chars === x) {
                this.current += chars.length
                return chars
            }
        } else if(x.prototype instanceof Parser) {
            let token;
            if(token = this.tokenize(x)) {
                return token.lexeme
            }
        }
        return null
    },
    check: function(...strings) {
        if(this.isAtEnd()) {
            return false;
        }
        for(let string of strings) {
            if(string === this.string.slice(this.current, this.current + string.length)) {
                return true
            }
        }
        return false
    },
    isAtEnd: function() {
        return this.current >= this.string.length 
    },
    error: function(message, start = null, length = 1) {
        if (start !== null) {
            string = this.string
            pointer = " ".repeat(start) + "^".repeat(length)
            message += "\n\n" + string + "\n" + pointer
        }
        return new ParserError(message)
    },
    report: function(error) {
        this.errors.push(error)
    }
}

function PageRefParser(string, current=0) {
    Parser.call(this, string, current)
    this.tokenType = Token.TYPES.PAGE_REF
}
PageRefParser.prototype = Object.create(Parser.prototype)
PageRefParser.prototype.constructor = PageRefParser
PageRefParser.prototype.parse = function() {
    if(this.current !== 0) {
        throw this.error(`Can only call parse from start of string, not: current = ${this.current}`)
    }
    let tokenStart = this.current;

    let tokens = [];
    if(!this.advance("[[")) {
        throw this.error("PageRef must start with [[", 0, 2)
    }
    while (!this.check("]]") && !this.isAtEnd()) {
        let token;
        if(token = this.tokenizeThis()) {
            tokens.push(token)
        } else {
            tokens.push(this.tokenizeChar(1, tokens))
        }
    }
    if(!this.advance("]]")) {
        throw this.error('Missing closing "]]" brackets', this.current, 2)
    }
    if(!this.isAtEnd()) {
        throw this.error('Extra characters after PageRef', this.current, this.string.length - this.current)
    }

    let lexeme = this.string.slice(tokenStart, this.current);
    return new Token(this.tokenType, lexeme, tokens, tokenStart)
}
PageRefParser.prototype.tokenizeThis = function() {
    let tokenStart = this.current;

    let tokens = [];
    if(!this.advance("[[")) return null
    while (!this.check("]]") && !this.isAtEnd()) {
        let token;
        if(token = this.tokenizeThis()) {
            tokens.push(token)
        } else {
            tokens.push(this.tokenizeChar(1, tokens))
        }
    }
    if(!this.advance("]]")) return null

    let lexeme = this.string.slice(tokenStart, this.current);
    return new Token(this.tokenType, lexeme, tokens, tokenStart)
}

function BlockRefParser(string, current=0) {
    Parser.call(this, string, current)
    this.tokenType = Token.TYPES.BLOCK_REF;
}
BlockRefParser.prototype = Object.create(Parser.prototype)
BlockRefParser.prototype.constructor = BlockRefParser
BlockRefParser.prototype.parse = function() {
    if(this.current !== 0) {
        throw this.error(`Can only call parse from start of string, not: current = ${this.current}`)
    }
    let tokenStart = this.current;

    let tokens = [];
    if(!this.advance("((")) {
        throw this.error('Missing opening "((" brackets', 0, 2)
    }
    while (!this.check("))") && !this.isAtEnd()) {
        let token;
        if(token = this.tokenizeThis()) {
            tokens.push(token)
        } else {
            tokens.push(this.tokenizeChar(1, tokens))
        }
    }
    if(!this.advance("))")) {
        throw this.error('Missing closing "))" brackets', this.current, 2)
    }
    if(!this.isAtEnd()) {
        throw this.error('Extra characters after BlockRef', this.current, this.string.length - this.current)
    }

    let lexeme = this.string.slice(tokenStart, this.current);
    return new Token(this.tokenType, lexeme, tokens, tokenStart)
}
BlockRefParser.prototype.tokenizeThis = function() {
    let tokenStart = this.current;

    let tokens = [];
    if(!this.advance("((")) return null
    while (!this.check("))") && !this.isAtEnd()) {
        let token;
        if(token = this.tokenizeThis()) {
            tokens.push(token)
        } else {
            tokens.push(this.tokenizeChar(1, tokens))
        }
    }
    if(!this.advance("))")) return null

    let lexeme = this.string.slice(tokenStart, this.current);
    return new Token(this.tokenType, lexeme, tokens, tokenStart)
}


function matchPageRef(string, options={global: false}) {
    let parser = new PageRefParser(string)
    let token = parser.next()
    while (token) {
        if (token.type === parser.tokenType) {
            let match = [ token.lexeme ];
            match.index = token.index;
            match.input = string;
            return match
        }
        token = parser.next()
    }
    return null;
}

function getPageRefAtIndex(string, index=0) {
    let parser = new PageRefParser(string, current=index)
    return parser.consumeToken()
}

function isPageRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new PageRefParser(x)
    try {
        parser.parse()
    } catch (e) {
        if (e instanceof ParserError) {
            return false
        }
    }
    return true
}

function isBlockRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new BlockRefParser(x)
    try {
        parser.parse()
    } catch (e) {
        if (e instanceof ParserError) {
            return false
        }
    }
    return true
}

function isBlockUid(x) {
    return typeof (x) === "string" && (x.match(/^[\w\d\-_]{9}$/) !== null || x.match(/\d\d\-\d\d-\d\d\d\d/) !== null) // TODO: finish
}


module.exports = { isBlockRef, isPageRef, isBlockUid, getPageRefAtIndex, matchPageRef, PageRefParser, BlockRefParser, Token, Parser, ParserError}