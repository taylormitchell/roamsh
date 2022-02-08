


function RoamScript() {
    this.hadError = false;
}
RoamScript.prototype.main = function(args) {
    if (args.length > 1) {
        console.log("Usage: RoamScript [script]");
        return
    } else if (args.length == 1) {
        runFile(args[0])
    } else {
        runPrompt();
    }
}
RoamScript.prototype.runPrompt = function() {
    // TODO
    this.run(source)
    this.hadError = false;
}
RoamScript.prototype.run = function(source) {
    var scanner = new Scanner(source);
    var tokens = scanner.scanTokens();
    for (var token of tokens) {
        console.log(token);
    }
    if (hadError) throw new Error("");
}
RoamScript.error = function(index, message) {
    report(index, "", message)
}
RoamScript.report = function(index, message) {
    console.error(`[index ${index}] Error: ${message}`);
    this.hadError = true;
}


// Create TokenType enum
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

Scanner.prototype.scanTokens = function() {
    while (!this.isAtEnd()) {
        this.start = this.current;
        this.scanToken()
    }
    return this.tokens;
}

Scanner.prototype.scanToken = function() {
    var c = this.source[this.current]
    if (c === "\\") {
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
}

Scanner.prototype.addToken = function(type, literal=null) {
    var lexeme = this.source.slice(this.start, this.current + 1)
    var token = new Token(type, lexeme, literal, this.start)
    this.tokens.push(token)
}

Scanner.prototype.advance = function() {
    this.current += 1
}

Scanner.prototype.isAtEnd = function() {
    return this.current >= this.source.length;
}


function Command(...expressions) {
    this.expressions = expressions;
}
Command.prototype.accept = function(visitor) {
    return visitor.visitCommand(this)
}

function Concat(...expressions) {
    this.expressions = expressions
}
Concat.prototype.accept = function(visitor) {
    return visitor.visitConcat(this)
}

function PageRef(...expressions) {
    this.expressions = expressions;
}
PageRef.prototype.accept = function(visitor) {
    return visitor.visitPageRef(this)
}

function Quote(...expressions) {
    this.expressions = expressions
}
Quote.prototype.accept = function(visitor) {
    return visitor.visitQuote(this)
}

function Literal(value) {
    this.value = value
}
Literal.prototype.accept = function(visitor) {
    return visitor.visitLiteral(this)
}
Literal.prototype.toString = function() {
    return this.value.toString()
}





function Parser(tokens) {
    this.tokens = tokens;
    this.current = 0;
}
Parser.prototype.parse = function() {
    return this.command()
}
Parser.prototype.command = function() {
    var terms = [];
    var term = this.term()
    while (term) {
        terms.push(term)
        var term = this.term()
    }

    return new Command(...terms)
}
Parser.prototype.term = function() {
    var expressions = []
    while (!this.match(TokenType.SPACE) && !this.isAtEnd()) {
        expressions.push(this.primary())
    }
    if (expressions.length === 0) return false
    if (expressions.length === 1) return expressions[0]
    return new Concat(...expressions)
}

Parser.prototype.primary = function() {
    if (this.match(TokenType.BACKSLASH)) new Literal(this.advance().lexeme)
    expr = this.quote()
    if (expr) return expr
    expr = this.pageRef()
    if (expr) return expr
    return new Literal(this.advance().lexeme)
}

Parser.prototype.quote = function() {
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
    return new Quote(...inner)
}

Parser.prototype.pageRef = function() {
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
    return new PageRef(...inner)
}

Parser.prototype.previous = function(i=0) {
    if (i === 0) return this.tokens[this.current - 1] 
    return this.tokens.slice(this.current - i, this.current)
}
Parser.prototype.peek = function(i=0) {
    return this.tokens[this.current + i]
}
Parser.prototype.advance = function(i=1) {
    if (!this.isAtEnd()) this.current += i
    return this.previous()

}
// Check the next series of token types match given types then advance
Parser.prototype.checkMany = function(...tokenTypes) {
    for (let [i, tokenType] of tokenTypes.entries()) {
        if (this.isAtEnd(i)) return false;
        if (tokenType !== this.peek(i).type) {
            return false
        }
    }
    return true
}
// Same as checkMany but advance if true
Parser.prototype.matchMany = function(...tokenTypes) {
    if (this.checkMany(...tokenTypes)) {
        this.advance(tokenTypes.length)
        return true
    }
    return false
}
// Check the next token matches _any_ of tokenTypes
Parser.prototype.check = function(...tokenTypes) {
    if (this.isAtEnd()) return false;
    for (let tokenType of tokenTypes) {
        if (tokenType === this.peek().type) {
            return true
        }
    }
    return false
}
// Same as check but advance if true
Parser.prototype.match = function(...tokenTypes) {
    if (this.check(...tokenTypes)) {
        this.advance()
        return true
    }
    return false
}
Parser.prototype.isAtEnd = function(i=0) {
    return (this.current + i) >= this.tokens.length
}
// Ignore this path stuff for now
//Parser.prototype.path = function() {
//    `Test Cases
//    valid
//    /path/to/thing
//    /path/to/thing/^$
//    [[Path]]/to/thing
//    ((aweawe))/to/thing/
//
//    invalid
//    [[Path]]wefawe/to/something
//    `
//    // Check for path root
//    var root = false;
//    matchers = [() => this.match(TokenType.SLASH), this.pageRef, this.blockRef]
//    for (matcher of matchers) {
//        root = matcher()
//        if (root) break
//    }
//    if (!root) return false
//
//    // Get relPath
//    let relPath = []
//    while (!this.match(TokenType.SPACE)) {
//        relPath.push(this.pathComponent())
//    }
//
//    // Get modifiers
//    var modifiers = []
//    lastItem = exprs.pop()
//    while (this.isModifier(lastItem)) {
//        modifiers.push(lastItem)
//        lastItem = exprs.pop()
//    }
//    exprs.push(lastItem)
//    modifiers.reverse()
//
//    return new Path(root, relPath, modifiers)
//}
// Parser.prototype.pathComponent = function() {
//     let expressions = []
//     while (!this.match(TokenType.SLASH, TokenType.SPACE)) {
//         for (func of [this.backslash, this.quote, this.pageRef, this.char]) {
//             let expr = func()
//             if (!expr) continue;
//             expressions.push(expr)
//             break;
//         }
//     }
//     if (this.previous().type == TokenType.SLASH) {
//         expressions.push(this.previous())
//     }
//     return new Expression(expressions)
// }


function Visitor() {}


function AstPrinter() {}
AstPrinter.prototype = Object.create(Visitor.prototype)
AstPrinter.prototype.constructor = AstPrinter
AstPrinter.prototype.print = function(expression) {
    return expression.accept(this);
}
AstPrinter.prototype.visitPageRef = function(expr) {
    return this.parenthesize("PageRef", ...expr.expressions)
}
AstPrinter.prototype.visitQuote = function(expr) {
    return this.parenthesize("Quote", ...expr.expressions)
}
AstPrinter.prototype.visitCommand = function(expr) {
    return this.parenthesize("Command", ...expr.expressions)
}
AstPrinter.prototype.visitConcat = function(expr) {
    return this.parenthesize("Concat", ...expr.expressions)
}
AstPrinter.prototype.visitLiteral = function(expr) {
    if (expr.value === null) return "nil";
    return '"' + expr.toString() + '"'
}
AstPrinter.prototype.parenthesize = function(name, ...exprs) {
    exprsString = exprs.map(expr => expr.accept(this)).join(" ")
    // expr.accept(this) runs the printer on the expression
    return `(${name} ${exprsString})` 
}


function Interpreter() {}
Interpreter.prototype = Object.create(Visitor.prototype)
Interpreter.prototype.constructor = Interpreter
Interpreter.prototype.interpret = function(expr) {
    let value = this.evaluate(expr)
    console.log(value)
}
Interpreter.prototype.visitCommand = function(expr) {
    var funcName = this.evaluate(expr.func).join("")
    let args = this.args.map(arg => this.evaluate(arg));
    var func = eval(funcName)
    return func(...args)
}

Interpreter.prototype.visitLiteral = function(expr) {
    return '"' + expr.value.toString() + '"'

}
Interpreter.prototype.visitQuote = function(expr) {
    var values = this.evaluate(expr.inside)
    if (values.length === 0) {
        return ""
    } else if (values.length === 1) {
        return values[0]
    } else if (values.length > 1) {
        return values.join("")
    }
}
Interpreter.prototype.visitPageRef = function(expr) {
    return {
        openBracket: this.evaluate(this.openBracket),
        inside: this.evaluate(this.inside),
        closeBracket: this.evaluate(this.closeBracket)
    }
}
Interpreter.prototype.evaluate = function(expr) {
    return expr.accept(this)
}


function main() {
    // var source = "ls [[Herp derp]]"
    // var source = `ls /[[something]]/that/"I think"/is a path"and""thing"`
    var source = `pri'nt[[derp]]"hi"' derp [[herp burp`
    console.log(source)
    var scanner = new Scanner(source)
    var tokens = scanner.scanTokens()
    console.log(tokens)
    var parser = new Parser(tokens)
    var expression = parser.parse()
    let printer = new AstPrinter()
    console.log(printer.print(expression))
//    var interpreter = new Interpreter()
//    var value = interpreter.interpret(expression)
//    console.log(value)
}


function test() {

    // Test Parser.pageRef
    // base case
    var source = "[[Page]]"
    tokens = (new Scanner(source)).scanTokens()
    parser = new Parser(tokens)
    pageRef = parser.pageRef()
    "Page".split("").forEach((expected, i) => {
        let actual = pageRef.title[i].value;
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


main()