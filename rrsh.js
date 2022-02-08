
function RoamResearchShell() {
    this.hadError = false;
}
RoamResearchShell.error = function(index, message) {
    report(index, "", message)
}
RoamResearchShell.report = function(index, message) {
    console.error(`[index ${index}] Error: ${message}`);
    this.hadError = true;
}
RoamResearchShell.prototype = {
    ...RoamResearchShell.prototype,
    main: function(args) {
        if (args.length > 1) {
            console.log("Usage: RoamScript [script]");
            return
        } else if (args.length == 1) {
            runFile(args[0])
        } else {
            runPrompt();
        }
    },
    runPrompt: function() {
        // TODO
        this.run(source)
        this.hadError = false;
    },
    run: function(source) {
        var scanner = new Scanner(source);
        var tokens = scanner.scanTokens();
        // if (hadError) throw new Error("");
        var parser = new Parser(tokens)
        var expression = parser.parse()
        var interpreter = new Interpreter()
        interpreter.interpret(expression)
    }
}

// Scanner

const tokenTypeList = [
    "BACKSLASH", "SPACE", "SEMI_COLON",
    "QUOTE_DOUBLE", "QUOTE_SINGLE",
    "SQUARE_OPEN", "SQUARE_CLOSE",
    "SINGLE_SQUARE_OPEN", "SINGLE_SQUARE_CLOSE",
    "CHAR", "SLASH", "DOLLAR", "CARROT"
];
TokenType = {}
tokenTypeList.forEach(type => TokenType[type] = type)


function Token(type, lexeme, literal, index) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.index = index;
}
Token.prototype.toString = function() {
    return `${this.type} ${this.lexeme} ${this.literal}`
}


function Scanner(source) {
    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
}
Scanner.prototype = {
    ...Scanner.prototype,
    scanTokens: function() { while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken()
        }
        return this.tokens;
    },
    scanToken: function() {
        var c = this.source[this.current]
        if (c === '\\') {
            this.addToken(TokenType.BACKSLASH)
        }
        else if (c === " ") {
            // treat each individually cause the first might be escape, becoming a character
            this.addToken(TokenType.SPACE)
        }
        else if (c === ";") {
            this.addToken(TokenType.SEMI_COLON);
        }
        else if (c === '"') {
            this.addToken(TokenType.QUOTE_DOUBLE);
        }
        else if (c === "'") {
            this.addToken(TokenType.QUOTE_SINGLE);
        }
        else if (c === "[") {
            this.addToken(TokenType.SQUARE_OPEN, "[");
        }
        else if (c === "]") {
            this.addToken(TokenType.SQUARE_CLOSE, "]");
        }
        else {
            this.addToken(TokenType.CHAR, c);
            // RoamScript.error(index, message)
        }
        this.advance()
    },
    addToken: function(type, literal=null) {
        var lexeme = this.source.slice(this.start, this.current + 1)
        var token = new Token(type, lexeme, literal, this.start)
        this.tokens.push(token)
    },
    advance: function() {
        this.current += 1
    },
    isAtEnd: function() {
        return this.current >= this.source.length;
    }
}

// Expressions

Expr = {
    Command: function(...expressions) {
        this.expressions = expressions;
    },
    Concat: function(...expressions) {
        this.expressions = expressions;
    },
    PageRef: function(...expressions) {
        this.expressions = expressions;
    },
    Quote: function(...expressions) {
        this.expressions = expressions;
    },
    Literal: function(value) {
        this.value = value;
    } 
}
// Add visitor interface to each Expression
for (const [name, constructor] of Object.entries(Expr)) {
    constructor.prototype.accept = function (visitor) {
        return visitor["visit"+name](this)
    }
}

// Parser

function Parser(tokens) {
    this.tokens = tokens;
    this.current = 0;
}
Parser.prototype = {
    ...Parser.prototype,
    parse: function() {
        return this.command()
    },
    command: function() {
        var terms = [];
        var term = this.term()
        while (term) {
            terms.push(term)
            var term = this.term()
        }

        return new Expr.Command(...terms)
    },
    term: function() {
        var expressions = []
        while (!this.match(TokenType.SPACE) && !this.isAtEnd()) {
            expressions.push(this.primary())
        }
        if (expressions.length === 0) return false
        if (expressions.length === 1) return expressions[0]
        return new Expr.Concat(...expressions)
    },
    primary: function() {
        if (this.match(TokenType.BACKSLASH)) {
            return new Expr.Literal(this.advance().lexeme)
        }
        expr = this.quote()
        if (expr) return expr
        expr = this.pageRef()
        if (expr) return expr
        return new Expr.Literal(this.advance().lexeme)
    },
    quote: function() {
        let start = this.current
        if (!(this.match(TokenType.QUOTE_DOUBLE, TokenType.QUOTE_SINGLE))) {
            return false
        }
        let openToken = this.previous()

        var inner = []
        while (!(this.checkMany(openToken.type) || this.isAtEnd())) {
            inner.push(this.primary())
        }

        if (!this.match(openToken.type)) {
            this.current = start
            return false
        }
        return new Expr.Quote(...inner)
    },
    pageRef: function() {
        let start = this.current
        // Start of page ref
        if (!(this.matchMany(TokenType.SQUARE_OPEN, TokenType.SQUARE_OPEN))) {
            return false
        }

        // Inside page ref
        var inner = []
        while (!(this.checkMany(TokenType.SQUARE_CLOSE, TokenType.SQUARE_CLOSE) || this.isAtEnd())) {
            inner.push(this.primary())
        }

        // End of page ref
        if (!(this.matchMany(TokenType.SQUARE_CLOSE, TokenType.SQUARE_CLOSE))) {
            this.current = start
            return false
        }
        return new Expr.PageRef(...inner)
    },
    previous: function(i=0) {
        if (i === 0) return this.tokens[this.current - 1] 
        return this.tokens.slice(this.current - i, this.current)
    },
    peek: function(i=0) {
        return this.tokens[this.current + i]
    },
    advance: function(i=1) {
        if (!this.isAtEnd()) this.current += i
        return this.previous()

    },
    // Check the next series of token types match given types then advance
    checkMany: function(...tokenTypes) {
        for (let [i, tokenType] of tokenTypes.entries()) {
            if (this.isAtEnd(i)) return false;
            if (tokenType !== this.peek(i).type) {
                return false
            }
        }
        return true
    },
    // Same as checkMany but advance if true
    matchMany: function(...tokenTypes) {
        if (this.checkMany(...tokenTypes)) {
            this.advance(tokenTypes.length)
            return true
        }
        return false
    },
    // Check the next token matches _any_ of tokenTypes
    check: function(...tokenTypes) {
        if (this.isAtEnd()) return false;
        for (let tokenType of tokenTypes) {
            if (tokenType === this.peek().type) {
                return true
            }
        }
        return false
    },
    // Same as check but advance if true
    match: function(...tokenTypes) {
        if (this.check(...tokenTypes)) {
            this.advance()
            return true
        }
        return false
    },
    isAtEnd: function(i=0) {
        return (this.current + i) >= this.tokens.length
    },
}


function AstPrinter() {}
AstPrinter.prototype = {
    ...AstPrinter.prototype,
    print: function(expression) {
        return expression.accept(this);
    },
    visitPageRef: function(expr) {
        return this.parenthesize("PageRef", ...expr.expressions)
    },
    visitQuote: function(expr) {
        return this.parenthesize("Quote", ...expr.expressions)
    },
    visitCommand: function(expr) {
        return this.parenthesize("Command", ...expr.expressions)
    },
    visitConcat: function(expr) {
        return this.parenthesize("Concat", ...expr.expressions)
    },
    visitLiteral: function(expr) {
        if (expr.value === null) return "nil";
        return '"' + expr.value.toString() + '"'
    },
    parenthesize: function(name, ...exprs) {
        exprsString = exprs.map(expr => expr.accept(this)).join(" ")
        // expr.accept(this) runs the printer on the expression
        return `(${name} ${exprsString})` 
    }
}


function RuntimeError(message) {
    instance = new Error(message);
    instance.name = 'RuntimeError';
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) {
        Error.captureStackTrace(instance, RuntimeError);
      }
    return instance;
}
RuntimeError.prototype = Object.create(Error.prototype)
RuntimeError.prototype.constructor = RuntimeError


function Interpreter() {}
Interpreter.prototype = {
    ...Interpreter.prototype,
    interpret: function(expr) {
        let value = this.evaluate(expr)
        console.log(value)
    },
    visitCommand: function(expr) {
        var terms = expr.expressions.map(expr => this.evaluate(expr))
        var func = this.getCommand(terms[0])
        var args = terms.slice(1)
        return func(...args)
    },
    getCommand: function(cmd) {
        try {
            var func = eval(cmd)
            if (!(func instanceof Function)) throw new ReferenceError()
        } catch (e) {
            if (e instanceof ReferenceError) {
                throw new RuntimeError(`command not found: ${cmd}`)
            } 
            throw e
        }
        return func
        
    },
    visitConcat: function(expr) {
        return expr.expressions.map(expr => this.evaluate(expr)).join("")
    },
    visitQuote: function(expr) {
        return expr.expressions.map(expr => this.evaluate(expr)).join("")
    },
    visitPageRef: function(expr) {
        return expr.expressions.map(expr => this.evaluate(expr)).join("")
    },
    visitLiteral: function(expr) {
        return expr.value
    },
    evaluate: function(expr) {
        return expr.accept(this)
    }
}

if (typeof require !== 'undefined' && require.main === module) {
    shell = new RoamResearchShell()
    shell.run(process.argv[2])
}
module.exports = { RoamResearchShell, Scanner, Parser }