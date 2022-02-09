
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


var Roam = {
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

module.exports = { Block, Page, Roam, mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat }