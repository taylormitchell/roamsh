


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


function Expr() {
}
Expr.prototype.accept = function() {
    throw "Expression needs to implement the accept method"
}


function Command(...terms) {
    this.terms = terms;
}
Command.prototype = Object.create(Expr.prototype)
Command.prototype.constructor = Command
Command.prototype.accept = function(visitor) {
    return visitor.visitCommand(this)
}

function List(...values) {
    this.values = values
}
List.prototype = Object.create(Expr.prototype)
List.prototype.constructor = List
List.prototype.accept = function(visitor) {
    return visitor.visitList(this)
}

function Concat(...values) {
    this.values = values
}
Concat.prototype = Object.create(Expr.prototype)
Concat.prototype.constructor = Concat
Concat.prototype.accept = function(visitor) {
    return visitor.visitConcat(this)
}


/**
 * 
 * @param {*} openBracket 
 * @param {Expr} inside 
 * @param {*} closedracket 
 */
function PageRef(openBracket, title, closeBracket) {
    this.openBracket = openBracket;
    this.inside = title;
    this.closeBracket = closeBracket;
}
PageRef.prototype = Object.create(Expr.prototype)
PageRef.prototype.constructor = PageRef
PageRef.prototype.accept = function(visitor) {
    return visitor.visitPageRef(this)
}


function BlockRef(uid) {
    this.uid = uid
}
BlockRef.prototype = Object.create(Expr.prototype)
BlockRef.prototype.constructor = BlockRef
BlockRef.prototype.accept = function(visitor) {
    return visitor.visitBlockRef(this)
}


/**
 * 
 * @param {"/"|PageRef|BlockRef} root 
 * @param {Array<string>} strings 
 */
function Path(root, strings) {
    this.root = root
    this.strings = string 
}
Path.prototype = Object.create(Expr.prototype)
Path.prototype.constructor = Path
Path.prototype.accept = function(visitor) {
    return visitor.visitPath(this)
}

function EscapedChar(backslash, value) {
    this.backslash = backslash
    this.value = value
}
EscapedChar.prototype = Object.create(Expr.prototype)
EscapedChar.prototype.constructor = EscapedChar
EscapedChar.prototype.accept = function(visitor) {
    return visitor.visitEscapedChar(this)
}
EscapedChar.prototype.toString = function() {
    return this.value.lexeme
}


function Literal(value) {
    this.value = value
}
Literal.prototype = Object.create(Expr.prototype)
Literal.prototype.constructor = Literal
Literal.prototype.accept = function(visitor) {
    return visitor.visitLiteral(this)
}
Literal.prototype.toString = function() {
    return this.value.toString()
}

function String(...chars) {
    this.chars = chars
}
String.prototype = Object.create(Expr.prototype)
String.prototype.constructor = String
String.prototype.accept = function(visitor) {
    return visitor.visitString(this)
}


function Func(expression) {
    this.expression = expression
}
Func.prototype = Object.create(Expr.prototype)
Func.prototype.constructor = Func
Func.prototype.accept = function(visitor) {
    return visitor.visitFunc(this)
}

function Arg(expression) {
    this.expression = expression
}
Arg.prototype = Object.create(Expr.prototype)
Arg.prototype.constructor = Arg
Arg.prototype.accept = function(visitor) {
    return visitor.visitArg(this)
}

/**
 * 
 * @param {string} quote 
 * @param {string|Path} value
 */
function Quote(open, inside, close) {
    this.open = open
    this.inside = inside
    this.close = close
}
Quote.prototype = Object.create(Expr.prototype)
Quote.prototype.constructor = Quote
Quote.prototype.accept = function(visitor) {
    return visitor.visitQuote(this)
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
    `Test cases
    ls "lo""gs" -> ls logs
    ls \""lo""gs" -> ls "logs
    lsEOL
    ls EOL
    \ls EOL
    l\sEOL
    ls\ EOL -> "ls "
    `
    var expressions = []
    var literals = []
    while (!this.match(TokenType.SPACE) && !this.isAtEnd()) {
        let expr = this.string()
        if (!expr) break // is this necessary?
        if (expr instanceof Literal) {
            literals.push(expr)
        } 
        else {
            if (literals.length > 0) {
                expressions.push(new String(...literals))
                literals = []
            }
            expressions.push(expr)
        }
    } 
    if (literals.length > 0) expressions.push(new String(...literals))

    if (expressions.length === 0) {
        return false
    } else if (expressions.length === 1) {
        return expressions[0]
    } else {
        return new Concat(...expressions)
    }
}
Parser.prototype.string = function() {
    // for (func of [this.backslash, this.quote, this.path, this.pageRef, this.char]) {
    for (let func of ["backslash", "quote", "pageRef"]) {
        let expr = this[func]()
        if (expr) return expr
    }
    let token = this.advance()
    return new Literal(token.literal)
}
Parser.prototype.backslash = function() {
    if (!(this.match(TokenType.BACKSLASH))) {
        return false
    }
    let token = this.advance()
    return new Literal(token.literal)
}
Parser.prototype.quote = function() {
    // Opening
    if (!(this.match(TokenType.QUOTE_DOUBLE, TokenType.QUOTE_SINGLE))) {
        return false
    }
    if (!this.match(TokenType.QUOTE_DOUBLE) && !this.match(TokenType.QUOTE_SINGLE)) {
        return false
    }
    if (!(this.match(TokenType.QUOTE_DOUBLE, TokenType.QUOTE_SINGLE))) {
        return false
    }
    var openToken = this.previous() 

    // Inside quotes
    var exprs = []
    var tokens = []
    while (!(this.match(openToken.type) || this.isAtEnd())) {
        expr = this.pageRef()
        if (expr) {
            if (tokens.length > 0) {
                exprs.push(new String(...tokens))
                tokens = []
            }
            exprs.push(expr)
        } else {
            tokens.push(this.advance())
        }
    }
    if (tokens.length > 0) exprs.push(new String(...tokens))

    // End of quote
    closeToken = this.previous()
    if (closeToken.type !== openToken.type) {
        throw "Reached end of line without a matching quote"
    }

    return new Quote(
        new Literal(openToken), 
        new List(...exprs),
        new Literal(closeToken)
    )
}

Parser.prototype.chars = function() {
    if (this.charTokens.length === 0) return false
    let literal = new Literal(charTokens.map(t => t.literal).join(""))
    this.charTokens = []
    return literal
}

Parser.prototype.pageRef = function() {
    // Start of page ref
    if (!(this.matchMany(TokenType.SQUARE_OPEN, TokenType.SQUARE_OPEN))) {
        return false
    }
    var open = new Literal(this.previous(2).map(t => t.literal).join(""))

    // Inside page ref
    var exprs = []
    var charTokens = []
    while (!(this.matchMany(TokenType.SQUARE_CLOSE, TokenType.SQUARE_CLOSE) || this.isAtEnd())) {
        expr = this.pageRef()
        if (expr) {
            literal = this.chars()
            if (literal) exprs.push(literal)
        } else {
            this.charTokens.push(this.advance())
        }
    }
    literal = this.chars()
    if (literal) exprs.push(literal)

    // End of page ref
    if (this.previous().type !== TokenType.SQUARE_CLOSE) {
        // Hit end of line without finding closing brackets
        return false
    }
    var close = new Literal(this.previous(2).map(t => t.literal).join(""))
    return new PageRef(open, inside, close)
}
Parser.prototype.previous = function(i=0) {
    if (i === 0) this.tokens[this.current - 1] 
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
Parser.prototype.matchMany = function(...tokenTypes) {
    for (let [i, tokenType] of Object.entries(tokenTypes)) {
        if (this.isAtEnd(i)) return false;
        if (tokenType !== this.peek(i).type) {
            return false
        }
    }
    this.advance(tokenTypes.length)
    return true
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
// Check the next token matches _any_ of tokenTypes then advance
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
    return this.parenthesize("PageRef", expr.openBracket, expr.inside, expr.closeBracket)
}
AstPrinter.prototype.visitQuote = function(expr) {
    return this.parenthesize("Quote", expr.open, expr.inside, expr.close)
}
AstPrinter.prototype.visitCommand = function(expr) {
    return this.parenthesize("Command", expr.func, ...expr.args)
}
AstPrinter.prototype.visitList = function(expr) {
    return this.parenthesize("List", ...expr.values)
}
AstPrinter.prototype.visitString = function(expr) {
    return '"' + expr.chars.map(c => c.toString()).join("") + '"'
}
AstPrinter.prototype.visitLiteral = function(expr) {
    if (expr.value === null) return "nil";
    return expr.toString()
}
AstPrinter.prototype.visitEscapedChar = function(expr) {
    if (expr.value === null) return "nil";
    return expr.toString()
}
AstPrinter.prototype.visitFunc = function(expr) {
    return this.parenthesize("Func", expr.expression)
}
AstPrinter.prototype.visitArg = function(expr) {
    return this.parenthesize("Arg", expr.expression)
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
    return expr.value
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
Interpreter.prototype.visitString = function(expr) {
    return expr.toString()
}

Interpreter.prototype.visitPageRef = function(expr) {
    return {
        openBracket: this.evaluate(this.openBracket),
        inside: this.evaluate(this.inside),
        closeBracket: this.evaluate(this.closeBracket)
    }
}
Interpreter.prototype.visitList = function(expr) {
    return expr.values.map(expr => this.evaluate(expr))
}
Interpreter.prototype.evaluate = function(expr) {
    return expr.accept(this)
}



function print(...args) {
    for (let arg of args) {
        console.log(arg)
    }
}

function main() {
    // var source = "ls [[Herp derp]]"
    // var source = `ls /[[something]]/that/"I think"/is a path"and""thing"`
    var source = "pri'nt' derp herp burp"
    console.log(source)
    var scanner = new Scanner(source)
    var tokens = scanner.scanTokens()
    console.log(tokens)
    var parser = new Parser(tokens)
    var expression = parser.parse()
    let printer = new AstPrinter()
    console.log(printer.print(expression))
    var interpreter = new Interpreter()
    var value = interpreter.interpret(expression)
    console.log(value)
}


main()

