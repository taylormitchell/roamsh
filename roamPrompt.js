

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
    // Factor in modifiers
    for (modifier of path.modifiers) {
        match = modifier.match(/\/(?:\[(\d+)\])?/)
        if (match) {
            idx = match[1] || 0
            block = block.getChildren()[idx]
        } else if ( modifier === "^" ) {
            block = block.getSiblingAbove()
        } else if (modifier == "$" ) {
            block = block.getSiblingBelow()
        } else {
            throw `"Invalid modifier: "${modifier}"`
        }
    }
    return block.getLocation()
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
    // Handle idx as a page title
    if (typeof(idx) === "string") {
        let title = isPageRef(idx) ? pageRefToTitle(idx) : idx
        let uid = window.roamAlphaAPI.q(`[
            :find ?uid .
            :where
                [?e :node/title "${title}"]
                [?e :block/uid ?uid]
        ]`)
        if (uid !== null) idx = uid
    }
    try {
        Block.call(this, idx)
    } catch {
        throw `identifier ${idx} is invalid for a Page`
    }
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
    let string = textarea.value
    commandHistory.addToEnd(string)
    await this.block.update("")
    try {
        let outputs = RoamScript.execute(string)
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
        string = "`".repeat(3)+"plain text" + "\n" + command+"`".repeat("`")
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

