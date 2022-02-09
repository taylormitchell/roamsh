let { Block, Page, Roam } = require('./core');






// Objects

function Path(string) {
    this.string = string
    this._modifiers, this._root, this._relPath;
    this._parsed = false;
}
Path.prototype = {
    ...Path.prototype,
    parse: function() {
        this.current = 0
        this.end = this.string.length
        this._modifiers = this.popModifiers()
        let [root, relPath] = this.getRootAndRelPath()
        this._root = root
        this._relPath = relPath
        delete this.current;
        delete this.end;
        this.parsed = true;
    },
    getRootAndRelPath: function(path) {
        let splitPath = this.split(path)
        var root, relPath;
        if (splitPath[0] === "") {
            root = "/"
            relPath = splitPath
        }
        else if (splitPath[0].slice(0,2) === "[[" && splitPath[0].slice(-2) === "]]") {
            root = splitPath[0] 
            relPath = splitPath.slice(1)
        }
        else if (splitPath[0].slice(0,2) === "((" && splitPath[0].slice(-2) === "))"){
            root = splitPath[0]
            relPath = splitPath.slice(1)
        }
        else {
            root = ""
            relPath = splitPath
        }
        return [root, ...relPath]
    },
    popModifiers: function() {
        let modifiers = []
        let pat = /((\/(\[\d+\])?)|\$|\^)$/
        let match = this.string.match(pat) 
        while (match !== null) {
            modifiers.push(match[0])
            this.end = match.index
            match = this.string.slice(0, this.end).match(pat) 
        }
        modifiers.reverse()
        return modifiers 
    },
    split: function() {
        let splitStrings = []
        while (!this.isAtEnd()) {
            let subString = this.parseTilSep()
            splitStrings.push(subString)
        }
        return splitStrings
    },
    parseTilSep: function() {
        let subString = ""
        while (!this.nextIs("/") && !this.isAtEnd()) {
            pageRef = this.pageRef()
            if (pageRef) {
                subString += pageRef
                continue
            } else {
                subString += this.advance()
            }
        }
        this.advance()
        return subString
    },
    pageRef: function() {
        let string = ""
        let start = this.current
        if (!this.nextIs("[[")) {
            return ""
        }
        string += this.advance(2)
        while (!this.nextIs("]]") && !this.isAtEnd()) {
            string += this.advance()
        }
        if (!this.nextIs("[[")) {
            this.current = start
            return ""
        }
        string += this.advance(2)
        return string
    },
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    advance: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        this.current += i
        return this.string.slice(this.current - i, this.current)
    },
    isAtEnd: function() {
        return this.current >= this.end
    },
    unmodified: function() {
        if (!this._parsed) this.parse()
        return this.modifiers.length > 0
    },
    root: function() {
        if (!this._parsed) this.parse()
        return this._root
    },
    relPath: function() {
        if (!this._parsed) this.parse()
        return this._relPath
    },
    modifiers: function() {
        if (!this._parsed) this.parse()
        return this._modifiers
    }
}
function testPath() {
    path = new Path("/path/to/something")
    if (path.root() !== "/") throw new Error()
    path = new Path("[[page]]/to/something")
    if (path.root() !== "[[page]]") throw new Error()
    path = new Path("path/to/something")
    if (path.root() !== "") throw new Error()
}

function Location(parentUid, order) {
    this.parentUid = parentUid
    this.order = order
}


// Helpers

function blockFromPath(path) {
    var location = pathToLocation(path)
    return Roam.getByLocation(location.parentUid, location.order)
}

function locationFromPath(path) {
    if (!(path instanceof Path)) {
        path = new Path(path)
    }
    var block;
    root = path.root();
    if (root == "/") {
        throw new Error("Path from graph root currently not supported")
    } else if (root == "") {
        block = Block.getFocused()
    } else if (roam.pathExists(root)) {
        block = new Page(root) 
    } else if (roam.blockExists(root)) {
        block = new Block(root) 
    } else {
        throw new Error("${root} root invalid. must be page, block, '/', or ''")
    }

    if (path.unmodified().length === 0) {
        var block = Block.getFocused()
    } else {
        if (path.root() === ".") { // TODO this feels hacky
            var block = Block.getFocused().getParent()
        } else {
            try { // assume it's a page title
                var block = new Page(path.root)
            } catch {
                try { // assume it's a block
                    var block = new Block(path.root)
                } catch {
                    throw `"${path.root}" isn't a valid root (page or block)`
                }
            }
        }
        for (const searchString of path.relPath) {
            let res = block.getChildren().filter(({ string }) => string === searchString)
            if (res.length === 0) {
                throw `"${searchString}" isn't a child of ${block}`
            }
            var block = res[0]
        }
    }
    var location = block.getLocation()
    // Factor in modifiers
    for (modifier of path.modifiers) {
        match = modifier.match(/\/(?:\[(\d+)\])?/)
        if (match) {
            idx = match[1] || 0
            location.parentUid = Block.fromLocation(location).uid
            location.order = idx
        } else if ( modifier === "^" ) {
            location.order -= 1
        } else if (modifier == "$" ) {
            location.order += 1
        } else {
            throw `"Invalid modifier: "${modifier}"`
        }
    }
    return location 
}


// Commands

async function createBlock(string, dst="") {
    let dstLoc = locationFromPath(dst)
    return Block.create(string, dstLoc)
}

async function deleteBlock(src) {
    let srcLoc = locationFromPath(src)
    let block = blockFromPath(srcLoc)
    return block.delete()
}

async function moveBlock(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    return srcBlock.move(dstLoc)
}

async function copyBlock(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    return Block.create(srcBlock.string, dstLoc)
}

async function refBlock(src, dst="") {
    let srcBlock = Block.fromLocation(Location.fromPath(src))
    let dstLoc = Location.fromPath(dst)
    return Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleExpandBlock(ref) {
    let block = Block.fromLocation(Location.fromPath(ref))
    return block.toggleExpand()
}

async function zoomBlock(ref) {
    let block = Block.fromLocation(Location.fromPath(ref))
    return block.zoom()
}

async function echo(string, dst="") {
    let dstBlock = Block.fromLocation(Location.fromPath(dst))
    return dstBlock.addChild(string)
}

async function cat(ref, dst="") {
    let block = Block.fromLocation(Location.fromPath(ref))
    let dstBlock = Block.fromLocation(Location.fromPath(dst))
    return dstBlock.addChild(block.string)
}

async function listChildren(src, dst="") {
    let srcBlock = Block.fromLocation(Location.fromPath(src))
    let dstBlock = Block.fromLocation(Location.fromPath(dst))
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.string)
    }
}

async function linkChildren(src, dst="") {
    let srcBlock = Block.fromLocation(Location.fromPath(src))
    let dstBlock = Block.fromLocation(Location.fromPath(dst))
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.getRef())
    }
}

// Aliases
mv = moveBlock
cp = copyBlock
ln = refBlock
rm = deleteBlock
mk = createBlock
ex = toggleExpandBlock
zm = zoomBlock 
ls = listChildren
lk = linkChildren

module.exports = { mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat }