var roamsh;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 742:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

let { Block, Page, Location } = __webpack_require__(304);
let graph = __webpack_require__(304);


function locationFromPath(path) {
    var res = graph.getByPath(path)
    if (res instanceof Page) {
        throw `Destination can't be a page: ${path}`
    } else if (res instanceof Block) {
        return new Location(res.getParent().uid, res.getOrder())
    } else {
        return res
    }
}

function blockFromPath(path) {
    var res = graph.getByPath(path) 
    if (!(res instanceof Block)) {
        throw `Not a block: ${path}`
    }
    return res
}

// Commands

async function createBlock(string="", dst="") {
    let dstLoc = locationFromPath(dst)
    await Block.create(string, dstLoc)
}

async function deleteBlock(src="^") {
    let block = blockFromPath(src)
    await block.delete()
}

async function moveBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await srcBlock.move(dstLoc)
}

async function copyBlock(src="^", dst="", opts = {recursive: true}) {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    // await Block.create(srcBlock.getString(), dstLoc)
    await srcBlock.copy(dstLoc, opts)
}

async function refBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleExpandBlock(src='^') {
    let block = blockFromPath(src)
    await block.toggleExpand()
}

async function zoom(src='^') {
    let blockOrPage = graph.getByPath(src) 
    await blockOrPage.open()
}

async function echo(string='', dst="/") {
    let dstLoc = locationFromPath(dst)
    await Block.create(string, dstLoc)
}

async function cat(src='^', dst="/") {
    let block = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(block.getString(), dstLoc)
}

async function listChildren(src='^', dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.getString())
    }
}

async function linkChildren(src='^', dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.getRef())
    }
}

async function run(src="^") {
    let codeBlock = blockFromPath(src)
    source = codeBlock.getString().trim() 
      .replace(new RegExp("^" + "`".repeat(3) + ".+"), "")
      .replace(new RegExp("`".repeat(3) + "$"), "")
      .trim();
    return await (async () => eval(source))();
}


module.exports = { createBlock, deleteBlock, moveBlock, copyBlock, refBlock, toggleExpandBlock, zoom, echo, cat, listChildren, linkChildren, run }

/***/ }),

/***/ 895:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

let { isBlockRef, isPageRef, isBlockUid } = __webpack_require__(706)


function Block(idx) {
    if (idx instanceof Block) {
        this.uid = idx.uid
    } else if (idx instanceof Location) {
        parent = new Block(location.parentUid)
        return parent.getChildren()[location.order]
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
    this.id = window.roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :block/uid "${this.uid}"]
    ]`)
}
Block.getFocused = function() {
    let res = roamAlphaAPI.ui.getFocusedBlock()
    if (!res) return null
    return new Block(res["block-uid"])
}
Block.getOpen = async function() {
    let obj = await getOpen()
    if (obj instanceof Block) {
        return obj
    }
    return null
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
Block.prototype = {
    ...Block.prototype,
    // Edit 
    update: async function (string) {
        res = await window.roamAlphaAPI
            .updateBlock(
                { "block": { "uid": this.uid, "string": string } })
        this.string = string
        return res
    },
    move: async function (location) {
        await window.roamAlphaAPI.moveBlock(
            {
                "location": { "parent-uid": location.parentUid, "order": location.order },
                "block": { "uid": this.uid }
            }
         );
    },
    copy: async function(location, opts = {recursive: true}) {
        let block = await Block.create(this.getString(), location)
        if(!opts.recursive) return block
        for(let [i, child] of this.getChildren().entries()) {
            await child.copy(new Location(block.uid, i), opts)
        }
    },
    delete: async function () {
        await window.roamAlphaAPI.deleteBlock(
            {
                "block": { "uid": this.uid }
            }
         );
    },
    addChild: async function (child, idx = 0) {
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
    },
    appendChild: async function (blockOrString) {
        let idx = (await this.getChildren() || []).length
        return this.addChild(blockOrString, idx)
    },
    // UI
    toggleExpand: async function () {
        await window.roamAlphaAPI.updateBlock(
            {"block": { "uid": this.uid, "open": !this.getOpen() }}
         );
    },
    open: async function () {
        await window.roamAlphaAPI.ui.mainWindow.openBlock(
            {block: {uid: this.uid}}
        )
    },
    focus: function() {
        return window.roamAlphaAPI.ui.setBlockFocusAndSelection(
            {location: {
                "block-uid": this.uid, 
                "window-id": "main-window"
            }
        });
    },
    // Datomic properties
    pull: function() {
        return window.roamAlphaAPI.pull("[*]", this.id)
    },
    getUid: function() {
        return this.uid
    },
    getId: function() {
        return this.id
    },
    getChildren: function () {
        let ids = this.getPropertyList("children")
        return ids
            .map((id) => new Block(id))
            .sort((x,y) => x.getOrder() - y.getOrder())
    },
    getString: function() {
        return this.getProperty("string")
    },
    getOrder: function() {
        return this.getProperty("order")
    }, 
    getRefs: function() {
        let ids = this.getPropertyList("refs")
        return ids.map(id => getById(id))
    },
    getParents: function (sorted=true) {
        let parents = window.roamAlphaAPI.q(`[
            :find [(pull ?p [*]) ...]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/parents ?p]
        ]`)
        if (sorted) parents = sortParents(parents)
        return parents.map(obj => getById(obj.id))
    },
    getPage: function() {
        let id = this.getProperty("page")
        return new Page(id)
    },
    getHeading: function() {
        return this.getProperty("heading")
    },
    getOpen: function() {
        return this.getProperty("open")
    },
    getTextAlign: function() {
        return this.getProperty("text-align")
    },
    getProps: function() {
        return this.getProperty("props")
    },
    getCreateEmail: function() {
        return this.getProperty("email", "create")
    },
    getCreateTime: function() {
        return this.getProperty("time", "create")
    },
    getEditEmail: function() {
        return this.getProperty("email", "edit")
    },
    getEditTime: function() {
        return this.getProperty("time", "edit")
    },
    getLookup: function() {
        let ids = this.getPropertyList("lookup", "attrs")
        return ids.map(id => getById(id))
    },
    // Derived properties
    getBackRefs: function() {
        return getBackRefs(this.uid)
    },
    getCreateDate: function() {
        return new Date(this.getCreateTime())
    },
    getEditDate: function() {
        return new Date(this.getEditTime())
    },
    getLocation: function () {
        let parent = this.getParent()
        return new Location(parent.uid, this.getOrder())
    },
    getRef: function () {
        return `((${this.uid}))`
    },
    getPageRefs: function() {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
                [?r :node/title]
        ]`)
        return ids.map(id => getById(id))
    },
    getBlockRefs: function() {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
                [?r :block/string]
        ]`)
        return ids.map(id => getById(id))
    },
    getParent: function () {
        return this.getParents().slice(-1)[0]
    },
    getSiblingAbove: function () {
        return this.getSiblingAdjacent(-1)
    },
    getSiblingBelow: function () {
        return this.getSiblingAdjacent(1)
    },
    getSiblingAdjacent: function(offset=1) {
        res = this.getSiblings().filter(({ order }) => order == this.order + offset)
        return res[0]
    },
    getSiblings: function () {
        let parent = this.getParent()
        return parent.getChildren()
    },
    getRelative: function (offset) {
        if (offset.direction === siblingDir) {
            return this.getSiblingAdjacent(offset.magnitude)
        } else if (offset.direction == descendantDir ) {
            if (offset.magnitude >= 0) {
                return this.getChildren()[offset.magnitude] 
            } else {
                return this.getParents()[-offset.magnitude]
            }
        }
    },
    // Helpers
    getProperty: function(name, namespace="block") {
        return window.roamAlphaAPI.q(`[
            :find ?v .
            :where
                [${this.id} :${namespace}/${name} ?v]
        ]`)
    },
    getPropertyList: function(name, namespace="block") {
        return window.roamAlphaAPI.q(`[
            :find [ ?v ... ]
            :where
                [${this.id} :${namespace}/${name} ?v]
        ]`)
    },
    getTextAreaElement: function () {
        return this.getElement().querySelector("textarea")
    },
    getElement: function () {
        let blockContentElement = document.querySelector(`[id$="${this.uid}"]:not(.rm-inline-reference [id$="${this.uid}"])`)
        if (!blockContentElement) {
            return null
        }
        let blockContainerElement = blockContentElement.parentElement
        while (!blockContainerElement.classList.contains("roam-block-container")) {
            blockContainerElement = blockContainerElement.parentElement
        }
        return blockContainerElement
    },
    isFocused: function() {
        return this.getTextAreaElement() !== null
    },
    exists: function() {
        let res = window.roamAlphaAPI.q(`[
            :find ?e .
            :where
                [?e :block/uid "${this.uid}"]
        ]`)
        return res !== null
    }
}


function Page(idx) {
    if (idx instanceof Page) {
        // Handle idx as page object
        this.uid = idx.uid
        this.id = idx.id
        return
    } else if (typeof(idx) === "number") {
        // Handle idx as internal id
        let obj = window.roamAlphaAPI.pull("[*]", idx)
        if (obj[":node/title"] === undefined) {
            throw "id ${idx} exists but isn't a Page object"
        }
        this.uid = obj[":block/uid"]
        this.id = obj[":db/id"]
        return
    } else if (typeof(idx) === "string") {
        let res, id, uid;
        // Handle idx as a page title
        let title = isPageRef(idx) ? idx.slice(2,-2) : idx
        res = window.roamAlphaAPI.q(`[
            :find [ ?e ?uid ]
            :where
                [?e :node/title "${title}"]
                [?e :block/uid ?uid]
        ]`)
        if (res) {
            [id, uid] = res
            this.id = id
            this.uid = uid
            return
        }
        // Handle idx as uid
        id = window.roamAlphaAPI.q(`[
            :find ?e .
            :where
                [?e :node/title]
                [?e :block/uid "${idx}"]
        ]`)
        if (id) {
            this.id = id
            this.uid = idx
            return
        }
    }
    throw `"${idx}" isn't a valid page id, uid, or title. If you're trying to create a new page, use \`Page.create("your title")\``
}
Page.create = async function (title) {
    if (!Page.exists(title)) {
        let uid = window.roamAlphaAPI.util.generateUID()
        await window.roamAlphaAPI.createPage({page: {title: title, uid: uid}})
    }
    return Page(title)
}
Page.getOpen = async function() {
    let obj = await getOpen()
    if (obj instanceof Block) {
        return obj.getPage()
    }
    return obj
}
Page.exists = function(title) {
    let res = window.roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :node/title "${title}"]
    ]`)
    return res !== null
},
Page.prototype = {
    ...Page.prototype,
    // Edit 
    update: async function (title) {
        return await window.roamAlphaAPI
            .updatePage(
                {"page": { "title": title, "uid": this.uid }})
    },
    delete: async function () {
        return await window.roamAlphaAPI.deletePage({"page": {"uid": this.uid }});
    },
    addChild: async function (blockOrString, idx = 0) {
        let loc = new Location(this.uid, idx)
        if (blockOrString instanceof Block) {
            let block = blockOrString
            await block.move(loc)
            return block
        } else {
            let string = blockOrString
            return Block.create(string.toString(), loc)
        }
    },
    appendChild: async function (blockOrString) {
        let idx = (await this.getChildren() || []).length
        return this.addChild(blockOrString, idx)
    },
    // UI
    open: async function () {
        await window.roamAlphaAPI.ui.mainWindow.openPage(
            {page: {uid: this.uid}}
        )
    },
    // Datomic properties
    pull: function() {
        return window.roamAlphaAPI.pull("[*]", this.id)
    },
    getChildren: function () {
        let ids = this.getPropertyList("children")
        return ids
            .map((id) => new Block(id))
            .sort((x,y) => x.getOrder() - y.getOrder())
    },
    getTitle: function() {
        return this.getProperty("title", "node")
    },
    getRefs: function() {
        let ids = this.getPropertyList("refs")
        return ids.map(id => getById(id))
    },
    getSideBar: function() {
        return this.getProperty("sidebar", "page")
    },
    getCreateEmail: function() {
        return this.getProperty("email", "create")
    },
    getCreateTime: function() {
        return this.getProperty("time", "create")
    },
    getEditEmail: function() {
        return this.getProperty("email", "edit")
    },
    getEditTime: function() {
        return this.getProperty("time", "edit")
    },
    getLookup: function() {
        let ids = this.getPropertyList("lookup", "attrs")
        return ids.map(id => getById(id))
    },
    // Derived properties
    getBackRefs: function() {
        return getBackRefs(this.uid)
    },
    getCreateDate: function() {
        return new Date(this.getCreateTime())
    },
    getEditDate: function() {
        return new Date(this.getEditTime())
    },
    getRef: function () {
        return `[[${this.getTitle()}]]`
    },
    getPageRefs: function() {
        return this.getRefs().filter(ref => ref instanceof Page)
    },
    // Helpers
    getProperty: function(name, namespace="block") {
        return window.roamAlphaAPI.q(`[
            :find ?v .
            :where
                [${this.id} :${namespace}/${name} ?v]
        ]`)
    },
    getPropertyList: function(name, namespace="block") {
        return window.roamAlphaAPI.q(`[
            :find [ ?v ... ]
            :where
                [${this.id} :${namespace}/${name} ?v]
        ]`)
    }
}


function Location(parentUid, order) {
    this.parentUid = parentUid
    this.order = order
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

function getById(id) {
    let obj = window.roamAlphaAPI.pull("[*]", id)
    if (obj[":node/title"] === undefined) {
        return new Block(id)
    } else {
        return new Page(id)
    }
}

function getByUid(uid) {
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

function getBackRefs(uid) {
    let ids = window.roamAlphaAPI.q(`[
        :find [ ?e ... ]
        :where
            [?e :block/refs ?refs]
            [?refs :block/uid "${uid}"]
    ]`)
    return ids.map(id => getById(id))
}

async function getOpen() {
    let uid = await roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
    return getByUid(uid)
}


module.exports = { Block, Page, Location, getById, getByUid }

/***/ }),

/***/ 984:
/***/ ((module) => {



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


function toRoamString(d = new Date()) {
    const monthNames = [
        "January", "February", "March", "April", "May", "June", "July", 
        "August", "September", "October", "November", "December"
    ];
    month = monthNames[d.getMonth()]
    day = d.getDate()
    suffix = getDateSuffix(day)
    year = d.getFullYear()
    return `${month} ${day}${suffix}, ${year}`
}


module.exports = { toRoamString }

/***/ }),

/***/ 304:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var { Block, Page, Location, getById, getByUid } = __webpack_require__(895) 
var { Path } = __webpack_require__(61) 
var { toRoamString } = __webpack_require__(984) 


function getByPath(pathString) {
    let path = new Path(pathString)
    return path.evaluate()
}

function get(string) {
    for (let f of [(s) => new Block(s), (s) => new Page(s), getByPath]) {
        try {
            return f(string)
        } catch (e) {}
    }
    throw `${string} isn't a valid internal id, uid, or path`
}

function getDailyNote(date = new Date()) {
    let title = toRoamString(date)
    return new Page(title)
}

async function asyncDailyNote(date = new Date()) {
    let title = toRoamString(date)
    if (Page.exists(title)) {
        return new Page(title)
    } else {
        return Page.create(title) // async
    }
}

module.exports = { Block, Page, Location, getById, getByUid, getByPath, get, getDailyNote, asyncDailyNote }

/***/ }),

/***/ 138:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

let path = __webpack_require__(61) 
let graph = __webpack_require__(304) 
let core = __webpack_require__(895) 
let commands = __webpack_require__(742) 
let terminal = __webpack_require__(170) 
let date = __webpack_require__(984) 


terminal.App.setUp()

mv = commands.moveBlock
cp = commands.copyBlock
ln = commands.refBlock
rm = commands.deleteBlock
mk = commands.createBlock
ex = commands.toggleExpandBlock
zm = commands.zoom 
ls = commands.listChildren
lk = commands.linkChildren
echo = commands.echo
cat = commands.cat
run = commands.run


module.exports = { path, graph, commands, terminal, date, core }

/***/ }),

/***/ 61:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

let { isBlockRef, isPageRef, getPageRefAtIndex } = __webpack_require__(706) 
let { Block, Page, Location } = __webpack_require__(895) 

ROOT_CHAR = "~"
PARENT_CHAR = "."
FOCUSED_CHAR = "_"

var START_TYPE_LIST = ["ROOT", "PARENT", "PAGE", "BLOCK", "FOCUSED"]
var START_TYPE = {}
START_TYPE_LIST.forEach(type => START_TYPE[type] = type)

var OFFSET_TYPE_LIST = ["SIBLING", "CHILD"]
var OFFSET_TYPE = {}
OFFSET_TYPE_LIST.forEach(type => OFFSET_TYPE[type] = type)


function Token(type, lexeme, value=null, index=null) {
    this.type = type
    this.lexeme = lexeme
    this.value = value
    this.index = index
}


function Path(string) {
    this.string = string;
    let parser = new PathParser(string)
    let [start, path, offset] = parser.parse()
    this.start = start;
    this.path = path;
    this.offset = offset;
}
Path.START_TYPE = START_TYPE 
Path.OFFSET_TYPE = OFFSET_TYPE 
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


function PathParser(string) {
    this.string = string;
    this.current = 0;
    this.end = this.string.length;
    this.start;
    this.offset = [];
    this.path = [];
}
PathParser.prototype = {
    ...PathParser.prototype,
    parse: function() {
        this.consumeOffset()
        this.consumeRootAndPath()
        return [this.start, this.path, this.offset]
    },
    consumeOffset: function() {
        while (!this.isAtEnd()) {
            if (this.endIs("^")) {
                token = new Token(OFFSET_TYPE.SIBLING, this.consumeCharEnd(), -1, this.end)
            } else if (this.endIs("$")) {
                token = new Token(OFFSET_TYPE.SIBLING, this.consumeCharEnd(), 1, this.end)
            } else if (offset = this.endMatches(/\/(?:\[(\d+)\])?$/)) {
                let char = this.consumeCharEnd(offset[0].length)
                let value = parseInt(offset[1] || 0)
                token = new Token(OFFSET_TYPE.CHILD, char, value, this.end)
            } else {
                break
            }
            this.offset.push(token)
        }
        this.offset.reverse()
    },
    consumeRootAndPath: function() {
        var strings = this.split()
        var first = strings[0] || ""
        if (isPageRef(first)) {
            this.start = new Token(START_TYPE.PAGE, first, first)
            this.path = strings.slice(1)
        } else if (isBlockRef(first)) {
            this.start = new Token(START_TYPE.BLOCK, first, first)
            this.path = strings.slice(1)
        } else if (first === PARENT_CHAR.repeat(first.length)) {
            this.start = new Token(START_TYPE.PARENT, first, first)
            this.path = strings.slice(1)
        } else if (first === ROOT_CHAR) {
            this.start = new Token(START_TYPE.ROOT, first, first)
            this.path = strings.slice(1)
        } else if (first === FOCUSED_CHAR) {
            this.start = new Token(START_TYPE.FOCUSED, first, first)
            this.path = strings.slice(1)
        } else {
            this.start = new Token(START_TYPE.FOCUSED, "", first)
            this.path = strings
        }
    },
    split: function() {
        let strings = []
        while (!this.isAtEnd()) {
            strings.push(this.consumeUpToSep())
        } 
        return strings
    },
    consumeUpToSep: function() {
        let string = ""
        while (!this.nextIs("/") && !this.isAtEnd()) {
            string += this.consumePageRef() || this.consumeChar()
        }
        this.consumeChar()
        return string
    },
    consumePageRef: function() {
        pageRef = getPageRefAtIndex(this.string, this.current)
        if (pageRef) {
            this.current += pageRef.length
            return pageRef
        }
        return null
    },
    consumeChar: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        this.current += i
        return this.string.slice(this.current - i, this.current)
    },
    consumeCharEnd: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        this.end -= i
        return this.string.slice(this.end, this.end + i)
    },
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    endIs: function(string) {
        return string === this.string.slice(this.end - string.length, this.end)
    },
    endMatches: function(regex) {
        return this.string.slice(0, this.end).match(regex)
    },
    isAtEnd: function() {
        return this.current >= this.end
    },
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
    // Get starting object
    var node;
    switch (this.path.start.type) {
        case Path.START_TYPE.ROOT:
            throw new LocationNotFound(`No support for paths starting at ${path.start} yet :(`);
        case Path.START_TYPE.PARENT:
            node = Block.getFocused()
            for (var i = 0; i < this.path.start.length; i++) {
                node = block.getParent();
            }
            break;
        case Path.START_TYPE.FOCUSED:
            node = Block.getFocused();
            break;
        case Path.START_TYPE.PAGE:
            node = new Page(this.path.start.lexeme);
            break;
        case Path.START_TYPE.BLOCK:
            node = new Block(this.path.start.lexeme);
            break;
        default:
            throw new LocationNotFound(`Invalid path start: ${this.path.start}`);
    }

    // Traverse path
    for (var searchString of this.path.path) {
        let res = node.getChildren().filter(child => child.getString() === searchString)
        if (res.length === 0) {
            throw new LocationNotFound(`"${searchString}" doesn't match any children of ${node.uid}`)
        }
        node = res[0]
    }

    // Traverse offset
    var location;
    for (var offset of this.path.offset) {
        if (location) {
            throw `Can't apply offset once path reaches `+
                  `new location: ${offset.lexeme} at index ${offset.index}`
        }
        switch (offset.type) {
            case Path.OFFSET_TYPE.SIBLING:
                if (node instanceof Page) {
                    this.error("Can't select a sibling of a Page", offset)
                }
                let order = node.getOrder() + offset.value
                let siblings = node.getSiblings()
                if (order < 0) {
                    location = new Location(node.getParent().uid, 0)
                } else if (order < siblings.length) {
                    node = siblings[order]
                } else if (order >= siblings.length) {
                    location = new Location(node.getParent().uid, siblings.length)
                }    
                break;
            case Path.OFFSET_TYPE.CHILD:
                let childNum = offset.value
                let children = node.getChildren()
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
                break;
            default:
                throw `Invalid offset type: ${offsetToken.type}`
        }
    }

    return location || node
}


module.exports = { Path }

/***/ }),

/***/ 403:
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
        return "[[" + expr.expressions.map(expr => this.evaluate(expr)).join("") + "]]"
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

/***/ }),

/***/ 706:
/***/ ((module) => {



function Parser(string, current=0) {
    this.string = string
    this.current = current
    this.start = current 
}
Parser.prototype = {
    ...Parser.prototype,
    getNext: function() {
        while (!this.isAtEnd()) {
            res = this.consumeToken()
            if (res) return res
            this.consumeChar()
        }
        return null
    },
    getAll: function() {
        strings = []
        string = this.getNext()
        while (string) {
            strings.push(string)
            string = this.getNext()
        }
        return strings
    },
    consume: function() {
        return this.consumeToken() || this.consumeChar()
    },
    consumeToken: function() {
        throw new Error("consume not implemented")
    },
    consumeChar: function(i=1) {
        if (i < 1) throw new Error("i must be 1 or greater")
        if (this.isAtEnd()) return null
        this.current += i
        this.start = this.current
        return this.string.slice(this.current - i, this.current)
    },
    nextIs: function(string) {
        return string === this.string.slice(this.current, this.current + string.length)
    },
    peak: function() {
        return this.string[this.current]
    },
    isAtEnd: function() {
        return this.current >= this.string.length 
    },
    null: function() {
        this.current = this.start
        return null
    }
}

function PageRefParser(string, current=0) {
    Parser.call(this, string, current)
}
PageRefParser.prototype = Object.create(Parser.prototype)
PageRefParser.prototype.constructor = PageRefParser
PageRefParser.prototype.consumeToken = function() {
    let res = ""
    if (!this.nextIs("[[")) return this.null()
    res += this.consumeChar(2)

    while (!this.nextIs("]]") && !this.isAtEnd()) {
        res += this.consumeToken() || this.consumeChar()
    }

    if (!this.nextIs("]]")) return this.null()
    res += this.consumeChar(2)

    return res
}

function BlockRefParser(string, current=0) {
    Parser.call(this, string, current)
}
BlockRefParser.prototype = Object.create(Parser.prototype)
BlockRefParser.prototype.constructor = BlockRefParser
BlockRefParser.prototype.consumeToken = function() {
    this.start = this.current
    let block = ""

    if (!this.nextIs("((")) return this.null()
    block += this.consumeChar(2)

    while (!this.nextIs("))") && !this.isAtEnd()) {
        block += this.consumeChar()
    }

    if (!this.nextIs("))")) return this.null()
    block += this.consumeChar(2)

    return block
}


function matchPageRef(string, options={global: false}) {
    var parser = new PageRefParser(string)
    var pageRef = parser.getNext()
    if (pageRef) {
        let match = [ pageRef ];
        match.index = parser.current - pageRef.length;
        match.input = string;
        return match
    }
    return null
}

function getPageRefAtIndex(string, index=0) {
    let parser = new PageRefParser(string, current=index)
    return parser.consumeToken()
}

function isPageRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new PageRefParser(x)
    let res = parser.consumeToken()
    return res !== null && res.length === x.length
}

function isBlockRef(x) {
    if (typeof(x) !== "string") return false
    let parser = new BlockRefParser(x)
    let res = parser.consumeToken()
    return res !== null && res.length === x.length
}

function isBlockUid(x) {
    return typeof (x) === "string" && (x.match(/^[\w\d\-_]{9}$/) !== null || x.match(/\d\d\-\d\d-\d\d\d\d/) !== null) // TODO: finish
}


module.exports = { isBlockRef, isPageRef, isBlockUid, getPageRefAtIndex, matchPageRef}

/***/ }),

/***/ 170:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

let { RoamResearchShell } = __webpack_require__(403);
let { Block, Page, Roam } = __webpack_require__(304);
// let { mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat } = require('./commands');

const TERM_LABEL = "roamsh: Terminal"
const TERM_ATTR = "roamshTermListener"
const CSS_ID = "roam-term"
const CSS = `
.roamTerm .rm-block-text
{
    background-color: rgb(235, 232, 232);
    border-radius: 0 5px 5px 0;
}

.roamTerm .prompt-prefix-area {
    background-color: rgb(235, 232, 232);
    display: flex;
    flex: 0 0 35px;
    margin-top: -1px;
    height: 29px;
    padding-top: 4px;
    padding-left: 4px;
    border-radius: 5px 0 0 5px;

}
`
PAGE_NAME_HISTORY = typeof(PAGE_NAME_HISTORY) === "undefined" ? "RoamTerm_history" : PAGE_NAME_HISTORY


function RoamTerm(block) {
    this.block = block
    this.uid = this.block.uid
    this.current = ""
    this.commandHistory = []
    this.commandHistoryId = 0
    this.observer = null;
}
RoamTerm.getFocused = function() {
    let block = Block.getFocused()
    if (!block) return null
    return new RoamTerm(block)
}
RoamTerm.prototype = {
    ...RoamTerm.prototype,
    // Verbs
    activate: function() {
        if (this.isActive()) return
        this.addHTML()
        this.addHotkeyListener()
        this.connectObserver()
    },
    deactivate: function() {
        if (!this.isActive()) return
        this.removeHTML()
        this.removeHotkeyListener()
        this.disconnectObserver()
    },
    execute: async function () {
        let textarea = this.block.getTextAreaElement()
        let source = textarea.value
        this.commandHistory.push(source)
        await this.block.update("")
        this.commandHistoryId = 0
        let res;
        try {
            res = await (async () => eval(source))()
            if (res) {
                let out = typeof(res) === 'object' ? JSON.stringify(res, null, "\t") : res
                await this.block.addChild(out.toString())
            } 
            // rrsh = new RoamResearchShell()
            // rrsh.run(source)
        } catch (error) {
            this.block.addChild(error.toString())
            throw error
        }
    },
    updateToPrevious: function() {
        if (this.commandHistoryId <= -this.commandHistory.length) {
            this.commandHistoryId = -this.commandHistory.length
            return
        }
        this.commandHistoryId = this.commandHistoryId - 1
        let previous = this.commandHistory.slice(this.commandHistoryId)[0]
        this.block.update(previous)
    },
    updateToNext: function() {
        let next;
        if (this.commandHistoryId < -1) {
            this.commandHistoryId = this.commandHistoryId + 1
            next = this.commandHistory.slice(this.commandHistoryId)[0]
        } else if (this.commandHistoryId === -1) {
            this.commandHistoryId = this.commandHistoryId + 1
            next = this.current
        } else {
            this.commandHistoryId = 0;
            next = ""
        }
        this.block.update(next)
    },
    hotkeyCallback: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="Enter") {
            if (!this.isEmpty()) this.execute()
        }
        if (e.ctrlKey && e.metaKey && e.key==="ArrowUp") {
            this.updateToPrevious()
        }
        if (e.ctrlKey && e.metaKey && e.key==="ArrowDown") {
            this.updateToNext()
        }
    },
    addHotkeyListener: function() {
        let el = this.block.getElement()
        this.hotkeyCallback = this.hotkeyCallback.bind(this)
        el.addEventListener("keydown", this.hotkeyCallback)
    },
    removeHotkeyListener: function() {
        let el = this.block.getElement()
        el.removeEventListener("keydown", this.hotkeyCallback)
    },
    addHTML: function() {
        let termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.add("roamTerm")
        let prefix = new PromptPrefix("~ %")
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", prefix.toElement())
        this.update()

    },
    removeHTML: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
        let prefix = termElement.querySelector(".prompt-prefix-area")
        if (prefix) prefix.remove()
    },
    // Properties
    blockExists: function() {
        return this.block.exists()
    },
    blockInView: function() {
        return this.block.getElement() !== null
    },
    blockIsFocused: function() {
        return this.block.isFocused()
    },
    isActive: function() {
        if (!this.blockExists()) return false
        if (!this.blockInView()) return false
        termElement = this.block.getElement()
        return termElement.querySelector(".rm-block-main").classList.contains("roamTerm")
    },
    isEmpty: function() {
        return this.getString() === ""
    },
    getString: function () {
        if (this.blockIsFocused()) {
            return this.block.getTextAreaElement().value
        } else {
            return this.block.getElement().innerText
        }
    },
    // Maintain UI
    update: function() {
        this.current = this.getString()
        let prefix = this.getPrefixElement()
        let input = this.getInputElement() 
        prefix.style.height = input.style.height 
    },
    connectObserver: function() {
        const targetNode = this.block.getElement();
        const config = { childList: true, subtree: true };
        this.update = this.update.bind(this)
        this.observer = new MutationObserver(this.update);
        this.observer.observe(targetNode, config);
    },
    disconnectObserver: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    getPrefixElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".prompt-prefix-area") : null
    },
    getInputElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".rm-block__input") : null
    }
}


function PromptPrefix(string) {
    this.string = string
}
PromptPrefix.prototype = {
    ...PromptPrefix.prototype,
    toElement: function () {
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
}


App = {
    prompts: {},
    observer: null,
    // Prompt stuff
    getPrompt: function(block) {
        let roamTerm = this.prompts[block.uid]
        if (!roamTerm) {
            roamTerm = new RoamTerm(block)
            this.prompts[block.uid] = roamTerm
        }
        return roamTerm
    },
    activatePrompt: function(roamTerm) {
        roamTerm.activate()
        this.prompts[roamTerm.block.uid] = roamTerm
        if (this.count() === 1) {
            this.connectObserver()
        }
    },
    deactivatePrompt: function(roamTerm) {
        roamTerm.deactivate()
        delete this.prompts[roamTerm.block.uid]
        if (this.count() === 0) {
            this.disconnectObserver()
        }
    },
    executePrompt: function(roamTerm) {
        roamTerm.execute()
    },
    togglePrompt: function(block) {
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            this.deactivatePrompt(roamTerm)
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    togglePromptOrExecute: function(block) {
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            if (!roamTerm.isEmpty()) {
                this.executePrompt(roamTerm)
            } else {
                this.deactivatePrompt(roamTerm)
            }
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    // Maintain UI and state
    update: function() {
        for(let [uid, prompt] of Object.entries(this.prompts)) {
            if (!prompt.blockExists()) {
                this.deactivatePrompt(prompt)
            } else if (!prompt.isActive() && prompt.blockInView()) {
                this.activatePrompt(prompt)
            }
        }
    },
    connectObserver: function() {
        const targetNode = document.querySelector('.roam-article');
        const config = { childList: true, subtree: true };
        this.update = this.update.bind(this)
        this.observer = new MutationObserver(this.update);
        this.observer.observe(targetNode, config);
    },
    disconnectObserver: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    // Set up and tear down  
    setUp: function() {
        this.addStyle()
        this.addCommandToPallete()
        this.addHotkeyListener()
    },
    tearDown: function() {
        for (let [uid, prompt] of Object.entries(this.prompts)) {
            this.deactivatePrompt(prompt)
        }
        this.removeCommandFromPallete()
        this.removeHotkeyListener()
    },
    addStyle: function() {
        let el = document.getElementById(CSS_ID);
        if (el) {
            return el
        }
        el = document.createElement("style");
        el.textContent = CSS;
        el.id = CSS_ID
        document.getElementsByTagName("head")[0].appendChild(el);
        return el;
    },
    commandPaletteCallback: function() {
        let block = Block.getFocused()
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            this.deactivatePrompt(roamTerm)
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    hotkeyCallback: function(e) {
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let block = Block.getFocused()
            const roamTerm = this.getPrompt(block)
            if (roamTerm.isActive() && roamTerm.isEmpty()) {
                this.deactivatePrompt(roamTerm)
            } else {
                this.activatePrompt(roamTerm)
            }
        }
    },
    addCommandToPallete: function() {
        this.commandPaletteCallback = this.commandPaletteCallback.bind(this)
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: TERM_LABEL, 
            callback: this.commandPaletteCallback    
        })
    },
    removeCommandFromPallete: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: TERM_LABEL})
    },
    addHotkeyListener: function() {
        this.hotkeyCallback = this.hotkeyCallback.bind(this)
        const roamApp = document.querySelector(".roam-app") 
        roamApp.addEventListener("keydown", this.hotkeyCallback) 
    },
    removeHotkeyListener: function() {
        const roamApp = document.querySelector(".roam-app") 
        roamApp.removeEventListener("keydown", this.hotkeyCallback)
    },
    // Helpers
    count: function() {
        return Object.keys(this.prompts).length
    },
}








module.exports = { App }

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
/******/ 	var __webpack_exports__ = __webpack_require__(__webpack_require__.s = 138);
/******/ 	roamsh = __webpack_exports__;
/******/ 	
/******/ })()
;