/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 9:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

const { RoamResearchShell, Scanner, Parser } = __webpack_require__(859);


///////////////
// Roam Core //
///////////////

// Helpers

function getDateSuffix(d) {
    lastDigit = d % 10
    if (d >= 11 && d <= 13) {
        return "th"
    } else if (lastDigit === 1) {
        return "st"
    } else if (lastDigit === 2) {
        return "nd"
    } else if (lastDigit === 3) {
        return "rd"
    } else {
        return "th"
    }
}

function getRoamDate(d = new Date()) {
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    month = monthNames[d.getMonth()]
    day = d.getDate()
    suffix = getDateSuffix(day)
    year = d.getFullYear()
    return `${month} ${day}${suffix}, ${year}`
}

function blockRefToUid(blockRef) {
    return blockRef.slice(2, -2)
}

function blockUidToRef(blockUid) {
    return `((${blockUid}))`
}

function isBlockUid(x) {
    return typeof (x) === "string" && (x.match(/^[\w\d\-_]{9}$/) !== null || x.match(/\d\d\-\d\d-\d\d\d\d/) !== null) // TODO: finish
}

function isBlockRef(x) {
    return typeof (x) === "string" && x.slice(0, 2) === "((" && x.slice(-2) === "))"
}

function pageRefToTitle(pageRef) {
    return pageRef.slice(2, -2)
}

function isPageRef(x) {
    return typeof (x) === "string" && x.slice(0, 2) === "[[" && x.slice(-2) === "]]"
}

function isPageTitle(string) {
    title = isPageRef(string) ? pageRefToTitle(string) : string
    let id = window.roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :node/title "${title}"]
    ]`)
    return id !== null
}

function sortParents(parents) {
    let maxiters = parents.length**2
    let count = 0
    let sortedParents = []
    while (parents.length > 0) {
        if (count > maxiters) {
            throw "Hit max iteration while sorting parents"
        }
        [parent, ...parents] = parents
        if (sortedParents.length === 0) {
            sortedParents.push(parent)
            continue;
        }
        let [ first, last ] = [ sortedParents[0], sortedParents[sortedParents.length - 1] ]
        if (last.children.map(obj => obj.id).includes(parent.id)) {
            // parent is a child of the last sorted node
            sortedParents.push(parent);
        } else if (parent.children.map(obj => obj.id).includes(first.id)) {
            // parent is parent of the first sorted node
            sortedParents = [parent].concat(sortedParents)
        } else {
            parents.push(parent)
        }
        count += 1
    }
    return sortedParents
}

// Objects


function PageRef(string) {
    this.string = string
}
PageRef.prototype.toString = function() {
    return this.string
}

function Path(string) {
    let { root, relPath, modifiers } = Path.parse(string)
    this.root = root
    this.relPath = relPath
    this.modifiers = modifiers
} 

Path.parse = function(string) {
    let root, dir, modifiers, tokens
    [ string, modifiers ] = Path.splitModifiers(string)
    tokens = Path.parsePageRefs(string)
    root = tokens[0] instanceof PageRef ? tokens[0].string : tokens[0]
    tokens = tokens.slice(1)
    relPath = Path.tokensToRelPath(tokens)
    return { root, relPath, modifiers }
}

Path.splitModifiers = function(path) {
    let modifiers = []
    let pat = /((\/(\[\d+\])?)|\$|\^)$/
    let match = path.match(pat) 
    while (match !== null) {
        modifiers.push(match[0])
        path = path.slice(0, match.index)
        match = path.match(pat) 
    }
    modifiers.reverse()
    return [path, modifiers] 
}

Path.tokensToRelPath = function(tokens) {
    // tokens is an array of PageRef objects and strings
    // e.g. tokens = ["/to/", PageRef("[[something]]"), " else/good", PageRef("[[page]]"), "/end"]
    let relPath = []
    let string = ""
    for (const token of tokens) {
        if (token instanceof PageRef) {
            string += token.string
        } else {
            for (const c of token) {
                if (c === "/") {
                    if (string.length > 0) {
                        relPath.push(string)
                        string = ""
                    }
                    // do nothing
                } else {
                    string += c
                }
            }
        }
    }
    if (string.length > 0 ) {
        relPath.push(string)
    }
    return relPath
}

Path.parsePageRefs = function(string) {
    pageRefLocs = Path.getPageRefLocations(string)
    let tokens = []
    lastEnd = 0
    for (loc of pageRefLocs) {
        let thisStart = loc[0]
        let thisEnd = loc[1]
        tokens.push(string.slice(lastEnd, thisStart))
        tokens.push(new PageRef(string.slice(thisStart, thisEnd)))
        lastEnd = thisEnd;
    }
    tokens.push(string.slice(lastEnd))
    tokens = tokens.filter(x => x !== "")
    return tokens
}

Path.getPageRefLocations = function(string) {
    let bracketCount = 0
    let pageLocs = []
    let pageLoc = []
    let i = 1
    while (i < string.length) {
        let token = string.slice(i-1, i+1)
        if (token === "[[") {
            bracketCount += 1
            if (pageLoc.length == 0) {
                // found start of page ref
                pageLoc.push(i-1) 
            }
            i += 2
        } else if (token === "]]") {
            bracketCount -= 1
            if (bracketCount === 0 && pageLoc.length > 0) {
                // found end of page ref
                pageLoc.push(i+1)
                pageLocs.push(pageLoc)
                pageLoc = []
            }
            i += 2
        } else {
            i += 1
        }
    }
    return pageLocs
}

Path.prototype.unmodified = function() {
    return [this.root].concat(this.relPath).join("/")
}



function Location(parentUid, order) {
    this.parentUid = parentUid
    this.order = order
}


Location.fromPath = function(path) {
    if (!(path instanceof Path)) {
        path = new Path(path)
    }
    if (path.unmodified().length === 0) {
        var block = Block.getFocused()
    } else {
        if (path.root === parentChar) { // TODO this feels hacky
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

// Location.fromPath = function(path) {
//     let [blockPath, offsetString] = splitOffset(path);
//     // Get block at absolute path location
//     if (!blockPath) {
//         var block = Block.getFocused()
//     } else {
//         let [first, ...theRest] = blockPath.split("/").filter(x => x.length > 0);
//         if (first === parentChar) { // TODO this feels hacky
//             var block = Block.getFocused().getParent()
//         } else {
//             try { // assume it's a page title
//                 var block = new Page(first)
//             } catch {
//                 try { // assume it's a block
//                     var block = new Block(first)
//                 } catch {
//                     throw `"${first}" in path isn't a valid page or block`
//                 }
//             }
//         }
//         for (const searchString of theRest) {
//             let res = block.getChildren().filter(({ string }) => string === searchString)
//             if (res.length === 0) {
//                 throw `"${searchString}" isn't a child of ${block}`
//             }
//             var block = res[0]
//         }

//     }
//     // Factor in offset
//     let offset = Offset.fromString(offsetString)
//     if (!offset) {
//         return new Location(block.getParent().uid, block.order)
//     } else if (offset.direction === siblingDir ) {
//         return new Location(block.getParent().uid, block.order + offset.magnitude)
//     } else if (offset.direction === descendantDir ) {
//         if (offset.magnitude >= 0) {
//             return new Location(block.uid, offset.magnitude)
//         } else {
//             ancestor = block.getParents().slice(offset.magnitude)[0]
//             return ancestor.getLocation()
//         }
//     } else {
//         throw `invalid offset: ${offset}`
//     }
// }

/**
 * Relative offset
 * @param {*} direction 
 * @param {*} magnitude 
 */
function Offset(direction, magnitude) {
    this.direction = direction
    this.magnitude = magnitude
}
Offset.fromString = function(string) {
    // TODO: support homogenous offset chars
    if (string[0]===adjacentBeforeChar) {
        return new this(siblingDir, -1*string.length)
    } else if (string[0]===adjacentAfterChar) {
        return new this(siblingDir, +1*string.length)
    } else if (string[0]===parentChar) {
        return new this(descendantDir, -1*string.length)
    } else if (string[0]===childChar) {
        return new this(descendantDir, +1*(string.length - 1))
    } else {
        return null
    }
}
function splitOffset(path) {
    pat = new RegExp(`[${offsetChars.map(x => "\\"+x).join("")}]+$`)
    match = path.match(pat)
    if (match) {
        return [path.slice(0, match.index), match[0]]
    } else {
        return [path, ""]
    }
}


var roam = {
    getById: function(id) {
        let obj = window.roamAlphaAPI.pull("[*]", id)
        if (obj[":node/title"] === undefined) {
            return new Block(id)
        } else {
            return new Page(id)
        }
    },
    getByUid: function(uid) {
        let obj = window.roamAlphaAPI.q(`[
            :find (pull ?e [*]) .
            :where
                [?e :block/uid "${uid}"]
        ]`)
        if (obj["title"] === undefined) {
            return new Block(obj["uid"])
        } else {
            return new Page(obj["uid"])
        }
    }
}


function Block(idx) {
    if (idx instanceof Block) {
        this.uid = idx.uid
    } else if (typeof(idx) === "number") {
        this.uid = window.roamAlphaAPI.q(`[
            :find ?uid .
            :where
                [${idx} :block/uid ?uid]
        ]`)
    } else if (typeof(idx) === "string") {
        if (isBlockRef(idx)) {
            this.uid = idx.slice(2, -2)
        } else if (isBlockUid(idx)) {
            this.uid = idx
        } else if (idx === ".") {
            this.uid = roamAlphaAPI.ui.getFocusedBlock()["block-uid"]
        }
    }
    if (!this.uid) throw `${idx} isn't a valid id, uid, or block`
    let blockAttrs = window.roamAlphaAPI.q(`[
        :find (pull ?e [*]) .
        :where
            [?e :block/uid "${this.uid}"]
    ]`)
    for (const [attr, val] of Object.entries(blockAttrs)) {
        this[attr] = val;
    }
}

Block.fromId = function (id) {
    let uid = window.roamAlphaAPI.q(`[
      :find ?uid .
      :where
         [${id} :block/uid ?uid]
    ]`)
    return new Block(uid)
}

// TODO: this should take uid and order as args instead
Block.fromLocation = function (location) {
    parent = new Block(location.parentUid)
    return parent.getChildren()[location.order]
}

Block.fromPath = function (path) {
    loc = new Location.fromPath(path)
    return Block.fromLocation(loc)
}

Block.create = async function (string = "", location=null) {
    if (!location) {
        let block = Block.getFocusedBlock()
        location = new Location(block.uid, 0)
    }
    // Create block
    let uid = window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.createBlock(
        {
            "location": { "parent-uid": location.parentUid, "order": location.order },
            "block": { "string": string, "uid": uid }
        }
    );
    return new Block(uid)
}

Block.getFocused = function() {
    let res = roamAlphaAPI.ui.getFocusedBlock()
    if (!res) return null
    return new Block(res["block-uid"])
}

Block.prototype.update = async function (string) {
    res = await window.roamAlphaAPI
        .updateBlock(
            { "block": { "uid": this.uid, "string": string } })
    this.string = string
    return res
}

Block.prototype.move = async function (location) {
    await window.roamAlphaAPI.moveBlock(
        {
            "location": { "parent-uid": location.parentUid, "order": location.order },
            "block": { "uid": this.uid }
        }
     );
}

Block.prototype.delete = async function () {
    await window.roamAlphaAPI.deleteBlock(
        {
            "block": { "uid": this.uid }
        }
     );
}

Block.prototype.toggleExpand = async function () {
    await window.roamAlphaAPI.updateBlock(
        {"block": { "uid": this.uid, "open": !this.open }}
     );
}

Block.prototype.zoom = async function () {
    await window.roamAlphaAPI.ui.mainWindow.openBlock(
        {block: {uid: this.uid}}
    )
}

Block.prototype.getString = function() {
    let string = window.roamAlphaAPI.q(`[
        :find ?s .
        :where
            [?e :block/uid "${this.uid}"]
            [?e :block/string ?s]
    ]`)
    return string
}

Block.prototype.getRefs = function() {
    let ids = window.roamAlphaAPI.q(`[
        :find [ ?r ... ]
        :where
            [?e :block/uid "${this.uid}"]
            [?e :block/refs ?r]
    ]`)
    return ids.map(id => roam.getById(id))
}

Block.prototype.getPageRefs = function() {
    let ids = window.roamAlphaAPI.q(`[
        :find [ ?r ... ]
        :where
            [?e :block/uid "${this.uid}"]
            [?e :block/refs ?r]
            [?r :node/title]
    ]`)
    return ids.map(id => roam.getById(id))
}

Block.prototype.getBlockRefs = function() {
    let ids = window.roamAlphaAPI.q(`[
        :find [ ?r ... ]
        :where
            [?e :block/uid "${this.uid}"]
            [?e :block/refs ?r]
            [?r :block/string]
    ]`)
    return ids.map(id => roam.getById(id))
}

Block.prototype.getChildren = function () {
    let uids = window.roamAlphaAPI.q(`[
            :find [?uid ...]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/children ?c]
                [?c :block/uid ?uid]
        ]`)
    return uids
        .map((uid) => new Block(uid))
        .sort((x,y) => x.order - y.order)
}

Block.prototype.getParent = function () {
    return this.getParents().slice(-1)[0]
}

Block.prototype.getParents = function (sorted=true) {
    let parents = window.roamAlphaAPI.q(`[
        :find [(pull ?p [*]) ...]
        :where
            [?e :block/uid "${this.uid}"]
            [?e :block/parents ?p]
    ]`)
    if (sorted) parents = sortParents(parents)
    return parents.map(obj => Block.fromId(obj.id))
}

Block.prototype.getSiblingAbove = function () {
    return this.getSiblingAdjacent(-1)
}

Block.prototype.getSiblingBelow = function () {
    return this.getSiblingAdjacent(1)
}

Block.prototype.getSiblingAdjacent = function(offset=1) {
    res = this.getSiblings().filter(({ order }) => order == this.order + offset)
    return res[0]
}

Block.prototype.getSiblings = function () {
    let parent = this.getParent()
    return parent.getChildren()
}

Block.prototype.getRef = function () {
    return `((${this.uid}))`
}

Block.prototype.getLocation = function () {
    let parent = this.getParent()
    return new Location(parent.uid, this.order)
}

Block.prototype.addChild = async function (child, idx = 0) {
    if (child instanceof Block) {
        await window.roamAlphaAPI.moveBlock(
            {
                "location": { "parent-uid": this.uid, "order": idx },
                "block": { "uid": child.uid }
            }
        );
        return new Block(block.uid)
    } else {
        return Block.create(child.toString(), new Location(this.uid, idx))
    }
}

Block.prototype.appendChild = async function (blockOrString) {
    let idx = (await this.getChildren() || []).length
    return this.addChild(blockOrString, idx)
}

Block.prototype.getElement = function () {
    blockContentElement = document.querySelector(`[id$="${this.uid}"]:not(.rm-inline-reference [id$="${this.uid}"])`)
    blockContainerElement = blockContentElement.parentElement
    while (!blockContainerElement.classList.contains("roam-block-container")) {
        blockContainerElement = blockContainerElement.parentElement
    }
    return blockContainerElement
}

Block.prototype.getTextAreaElement = function () {
    return this.getElement().querySelector("textarea")
}

Block.prototype.getRelative = function (offset) {
    if (offset.direction === siblingDir) {
        return this.getSiblingAdjacent(offset.magnitude)
    } else if (offset.direction == descendantDir ) {
        if (offset.magnitude >= 0) {
            return this.getChildren()[offset.magnitude] 
        } else {
            return this.getParents()[-offset.magnitude]
        }
    }
}

Block.prototype.createDate = function() {
    let timestamp = roamAlphaAPI.q(`[
        :find ?t .
        :where
            [?e :block/uid "${this.uid}"]
            [?e :create/time ?t]
    ]`)
    return new Date(timestamp)
}


function Page(idx) {
    if (idx instanceof Page) {
        // Handle idx as page object
        this.uid = idx.uid
        return
    } else if (typeof(idx) === "number") {
        // Handle idx as internal id
        let obj = window.roamAlphaAPI.pull("[*]", id)
        if (obj[":node/title"] === undefined) {
            throw "id ${idx} exists but isn't a Page object"
        }
        this.uid = obj[":block/uid"]
        return
    } else if (typeof(idx) === "string") {
        // Handle idx as a page title
        let title = isPageRef(idx) ? pageRefToTitle(idx) : idx
        let uid = window.roamAlphaAPI.q(`[
            :find ?uid .
            :where
                [?e :node/title "${title}"]
                [?e :block/uid ?uid]
        ]`)
        if (uid !== null) {
            this.uid = uid
            return
        } 
        // Handle idx as uid
        let id = window.roamAlphaAPI.q(`[
            :find ?e .
            :where
                [?e :block/uid "${idx}"]
                [?e :node/title]
        ]`)
        if (id) {
            this.uid = idx
            return
        }
    }
    throw `identifier ${idx} is invalid for a Page`
}
Page.prototype = Object.create(Block.prototype)
Page.prototype.constructor = Page;


function block(o) {
    if (isBlockUid(o) || o === ".") {
        return new Block(o)
    } else if (isBlockRef(o)) {
        return new Block(blockRefToUid(o))
    } else if (isPageTitle(o)) {
        return new Page(o)
    } else {
        // assume it's a path
        let loc = Location.fromPath(o)
        return Block.fromLocation(loc)
    }
}


/////////////////
// Roam Script //
/////////////////


async function createBlock(string, dst="") {
    let dstLoc = Location.fromPath(dst)
    return Block.create(string, dstLoc)
}

async function deleteBlock(src) {
    let srcLoc = Location.fromPath(src)
    let block = Block.fromLocation(srcLoc)
    return block.delete()
}

async function moveBlock(src, dst="") {
    let srcBlock = Block.fromLocation(Location.fromPath(src))
    let dstLoc = Location.fromPath(dst)
    return srcBlock.move(dstLoc)
}

async function copyBlock(src, dst="") {
    let srcBlock = Block.fromLocation(Location.fromPath(src))
    let dstLoc = Location.fromPath(dst)
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


RoamScript = {
    execute: function(script) {
        let lines = script.trim()
            .split('\n')
            .map(x => x.split(";"))
            .reduce((x, y) => x.concat(y))
        let outputs = [] 
        for (const line of lines) {
            let tokens = tokenifier(line)
            // Transpile roam script to javascript
            let [f, ...args] = tokens
            args = args.map(x => '"' + x + '"').join(",")
            var source = `${f}(${args})`
            res = eval(source)
            console.log(res)
        }
        return outputs
    }
}
function tokenifier(string) {
    string = string.trim()
    // let tokens = Path.parsePageRefs(string)
    let tokens = tokenifier.parseQuotedText(string)
    tokens = tokenifier.splitTokens(tokens)
    tokens = tokens.map(x => x instanceof Array ? x[1] : x)
    return tokens
}
tokenifier.parseQuotedText = function (string) {
    let strings = string instanceof Array ? string : [ string ]
    let newTokens = []
    for (string of strings) {
        if (typeof(string) !== "string") {
            newTokens.push(string)
            continue
        }
        let matches = string.matchAll(/["']([^"']*)["']/g)
        let lastEnd = 0
        for (match of matches) {
            let thisStart = match.index
            let thisEnd = thisStart + match[0].length
            newTokens.push(string.slice(lastEnd, thisStart))
            newTokens.push(match)
            lastEnd = thisEnd;
        }
        newTokens.push(string.slice(lastEnd))
    }
    return newTokens
    
}
tokenifier.splitTokens = function (tokens) {
    let newTokens = [];
    for (const token of tokens) {
        if (typeof (token) === "string") {
            newTokens = newTokens.concat(token.split(" "))
        } else {
            newTokens.push(token)
        }
    }
    return newTokens.filter(x => x.length > 0)
}


///////////////////
// Roam Terminal //
///////////////////

siblingDir = "sibling"
descendantDir = "descendant"
adjacentBeforeChar = "^"
adjacentAfterChar = "$"
childChar = "/"
parentChar = "."
offsetChars = [adjacentAfterChar, adjacentBeforeChar, childChar, parentChar]
pageNameHistory = "RoamTerm_history"


function RoamTerm(block) {
    this.block = block
    this.uid = this.block.uid
    this.commandHistoryId = 0
}

RoamTerm.getFocused = function() {
    let block = Block.getFocused()
    if (!block) return null
    return new RoamTerm(block)
}

RoamTerm.prototype.isActive = function() {
    termElement = this.block.getElement()
    return termElement.querySelector(".rm-block-main").classList.contains("roamTerm")
}
RoamTerm.prototype.activate = function() {
    termElement = this.block.getElement()
    termElement.querySelector(".rm-block-main").classList.add("roamTerm")
    promptPrefix = new PromptPrefix("~ %")
    termElement
        .querySelector(".controls")
        .insertAdjacentElement("afterEnd", promptPrefix.toElement())
}
RoamTerm.prototype.deactivate = function() {
    termElement = this.block.getElement()
    termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
    termElement.querySelector(".prompt-prefix-area").remove()
}
RoamTerm.prototype.execute = async function () {
    let textarea = this.block.getTextAreaElement()
    let source = textarea.value
    commandHistory.addToEnd(source)
    await this.block.update("")
    try {
        rrsh = new RoamResearchShell()
        rrsh.run(source)
    } catch (error) {
        this.block.addChild(error.toString())
        throw error
    }
    // for (const out of outputs) {
    //     await this.block.addChild(await out)
    // }
}
RoamTerm.prototype.string = function () {
    return this.block.getTextAreaElement().value
}


function PromptPrefix(string) {
    this.string = string
}
PromptPrefix.prototype.toElement = function () {
    prefixArea = document.createElement("div")
    prefixArea.classList.add("prompt-prefix-area")
    prefixContent = document.createElement("div")
    prefixContent.classList.add("prompt-prefix-str")
    prefixStr = document.createElement("span")
    prefixStr.innerText = this.string
    prefixContent.appendChild(prefixStr)
    prefixArea.appendChild(prefixContent)
    return prefixArea
}


commandHistory = {
    getFromEnd: function(numFromEnd=-1) {
        p = new Page(pageNameHistory)
        string = p.getChildren().slice(numFromEnd)[0].string
        commandLines = string.split("\n").slice(1)
        commandLines[commandLines.length - 1] = commandLines.slice(-1)[0].slice(0,-3)
        return commandLines.join("\n")
    },
    addToEnd: function(command) {
        let p = new Page(pageNameHistory)
        string = "`".repeat(3)+"plain text" + "\n" + command+"`".repeat(3)
        p.appendChild(string)
    }
}


if (typeof document !== "undefined") {
    document.onkeydown = function (e) {
        if (e.key === "Backspace") {
            let roamTerm = RoamTerm.getFocused()
            if (roamTerm !== null && roamTerm.isActive() && !roamTerm.string()) {
                roamTerm.deactivate()
            }
        }
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let b = Block.getFocused()
            let roamTerm = new RoamTerm(b)
            if (roamTerm.isActive()) {
                if (roamTerm.string()) {
                    roamTerm.execute()
                    roamTerm.commandHistoryId = 0
                } else {
                    roamTerm.deactivate()
                }
            } else {
                roamTerm.activate()
            }
        }
        if (e.ctrlKey && e.metaKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
            let b = Block.getFocused()
            let roamTerm = new RoamTerm(b)
            if (roamTerm.isActive()) {
                if (e.key == "ArrowUp") {
                    roamTerm.commandHistoryId = roamTerm.commandHistoryId - 1
                } else {
                    roamTerm.commandHistoryId = roamTerm.commandHistoryId >= -1 ? -1 : roamTerm.commandHistoryId + 1
                }
                oldCommand = commandHistory.getFromEnd(roamTerm.commandHistoryId)
                roamTerm.block.update(oldCommand)
            }

        }
    };
}



/***/ }),

/***/ 859:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* module decorator */ module = __webpack_require__.nmd(module);

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

if ( true && __webpack_require__.c[__webpack_require__.s] === module) {
    shell = new RoamResearchShell()
    shell.run(process.argv[2])
}
module.exports = { RoamResearchShell, Scanner, Parser }

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			loaded: false,
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = __webpack_module_cache__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__webpack_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// module cache are used so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	var __webpack_exports__ = __webpack_require__(__webpack_require__.s = 9);
/******/ 	
/******/ })()
;