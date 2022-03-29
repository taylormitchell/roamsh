var { Path, pathToLocation } = require("./path") 
var { sortParents, Location, NotFoundError } = require("./util") 
let util = require("./util") 
let { isBlockRef, isPageRef, isBlockUid, ParserError } = require("./str")
var { toRoamString } = require("./date") 


function Block(idx) {
    if (idx instanceof Block) {
        this.uid = idx.uid
    } else if (idx instanceof Location) {
        parent = new Block(location.parentUid)
        return parent.getChildren()[location.order]
    // Assume it's an internal id
    } else if (typeof(idx) === "number") {
        this.uid = window.roamAlphaAPI.q(`[
            :find ?uid .
            :where
                [${idx} :block/uid ?uid]
        ]`)
    } else if (typeof(idx) === "string") {
        // Assume it's a block reference or uid
        if (isBlockRef(idx)) {
            this.uid = idx.slice(2, -2)
        } else if (isBlockUid(idx)) {
            this.uid = idx
        // Assume it's a path to a block
        } else {
            let uid;
            try {
                let path = new Path(idx)
                res = path.evaluate()
                if(!(res instanceof Location)) {
                    uid = res[":block/uid"]
                }
            } catch(e) {
                // If it's a ParserError, that just means it wasn't a valid path
                // which could very well be the case. If it's a NotFoundError, we'll
                // also skip it and throw the generic block-not-found error later
                if(!(e instanceof ParserError || e instanceof NotFoundError)) {
                    throw e
                }
            }
            // res will be a Location or uid string
            if(typeof(uid) === 'string') {
                this.uid
            }
        }
    }
    if (!this.uid) throw new NotFoundError(`${idx} isn't a valid id, uid, block, or path`)
    this.id = window.roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :block/uid "${this.uid}"]
    ]`)
}
Block.getFocused = function() {
    let obj = util.getFocused()
    if(obj) {
        return new Block(obj[":block/uid"])
    }
    return null
}
Block.getOpen = async function() {
    let obj = await getOpen()
    if (obj instanceof Block) {
        return obj
    }
    return null
}
Block.create = async function (string = "", location=null) {
    location = getLocation(location)
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
            return new Block(child.uid)
        } else {
            return await Block.create(child.toString(), new Location(this.uid, idx))
        }
    },
    appendChild: async function (blockOrString) {
        let idx = (await this.getChildren() || []).length
        return this.addChild(blockOrString, idx)
    },
    addSibling: async function(sibling = '', idx=0) {
        if (sibling instanceof Block) {
            await window.roamAlphaAPI.moveBlock(
                {
                    "location": { "parent-uid": this.getParent().uid, "order": this.getOrder() + idx },
                    "block": { "uid": sibling.uid }
                }
            );
            return new Block(sibling.uid)
        }
        return Block.create(sibling.toString(), new Location(this.getParent().uid, this.getOrder() + idx))
    },
    addSiblingAbove: async function(sibling='', idx=0) {
        if(idx < 0) {
            throw `Indexer must be positive: ${idx}`
        }
        return await this.addSibling(sibling, -idx)
    },
    addSiblingBelow: async function(sibling='', idx=0) {
        if(idx < 0) {
            throw `Indexer must be positive: ${idx}`
        }
        return await this.addSibling(sibling, idx+1)
    },
    move: async function (idx) {
        let location = getLocation(idx)
        window.roamAlphaAPI.moveBlock(
            {
                "location": { "parent-uid": location.parentUid, "order": location.order },
                "block": { "uid": this.uid }
            }
         );
         return this
    },
    copy: async function(idx, opts = {recursive: true, reference: false}) {
        let location = getLocation(idx)
        let string = opts.reference ? this.toRef() : this.getString() 
        let block = await Block.create(string, location)
        if(!opts.recursive) return
        for(let [i, child] of this.getChildren().entries()) {
            await child.copy(new Location(block.uid, i), opts)
        }
        return block
    },
    copyChildren: async function(idx, opts = {recursive: true, reference: false}) {
        let location = getLocation(idx)
        let newChildren = [];
        for (let child of this.getChildren()) {
            newChildren.push(await child.copy(location, opts))
            location.order += 1
        }
        return newChildren
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
    getChildren: function (sorted=true) {
        let children = util.getChildren(this.id, sorted)
        return children.map(c => new Block(c[':db/id']))
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
        let parents = util.getParents(this.id, sorted)
        return parents.map(p => getById(p[":db/id"]))
    },
    getPage: function() {
        let id = this.getProperty("page")[':db/id']
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
    getFirstChildLocation: function() {
        return new Location(this.uid, 0)
    },
    getNextChildLocation: function() {
        let children = this.getChildren()
        return new Location(this.uid, children.length)
    },
    toRef: function () {
        return `((${this.uid}))`
    },
    toLocation: function() {
        return new Location(this.getParent().uid, this.getOrder())
    },
    getPageRefs: function(inherit=true) {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
                [?r :node/title]
        ]`)
        let refs = ids.map(id => getById(id))
        if(inherit) {
            let parents = this.getParents()
            refsInParents = parents.map(p => p.getPageRefs(false)).flat()
            refs = refs.concat(refsInParents) 
            refs.push(parents[0])
        }
        return [...new Set(refs)]
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
    // Helpers
    getProperty: function(name, namespace="block") {
        let obj = util.getById(this.id)
        return obj[`:${namespace}/${name}`]
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
    },
    toEmbed: function() {
        return `{{[[embed]]: ${this.toRef()}}}` 
    },
    inView: function() {
        return this.getElement() !== null
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
            throw new NotFoundError("id ${idx} exists but isn't a Page object")
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
    throw new NotFoundError(`"${idx}" isn't a valid page id, uid, or title. If you're trying to create a new page, use \`Page.create("your title")\``)
}
Page.create = async function (title) {
    if (!Page.exists(title)) {
        let uid = window.roamAlphaAPI.util.generateUID()
        await window.roamAlphaAPI.createPage({page: {title: title, uid: uid}})
    }
    return new Page(title)
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
        let children = util.getChildren(this.id)
        return children.map(c => new Block(c[':db/id']))
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
    getFirstChildLocation: function() {
        return new Location(this.uid, 0)
    },
    getNextChildLocation: function() {
        let children = this.getChildren()
        return new Location(this.uid, children.length)
    },
    toRef: function () {
        return `[[${this.getTitle()}]]`
    },
    getPageRefs: function() {
        let refs = this.getRefs().filter(ref => ref instanceof Page)
        return refs
    },
    // Helpers
    getProperty: function(name, namespace="block") {
        let obj = util.getById(this.id)
        return obj[`:${namespace}/${name}`]
    },
    getPropertyList: function(name, namespace="block") {
        return window.roamAlphaAPI.q(`[
            :find [ ?v ... ]
            :where
                [${this.id} :${namespace}/${name} ?v]
        ]`)
    }
}

async function getOpen() {
    let uid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
    return getByUid(uid)
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

function getByPath(pathString) {
    try {
        let path = new Path(pathString)
        let res = path.evaluate()
        if(res instanceof Location) {
            return res
        } else {
            return getByUid(res[":block/uid"])
        }
    } catch (e) {
        if(e instanceof NotFoundError) {
            return null
        }
        throw e
    }
}

function getPage(idx) {
    try {
        return new Page(idx)
    } catch (e) {
        if(e instanceof NotFoundError) {
            return null
        }
        throw e
    }
}

function getBlock(idx) {
    try {
        return new Block(idx)
    } catch (e) {
        if(e instanceof NotFoundError) {
            return null
        }
        throw e
    }
}

function getLocation(idx) {
    if(!idx) {
        return new Location(util.getFocused(), 0)
    } else if(idx instanceof Location) {
        return idx
    } else if(idx instanceof Block) {
        return idx.toLocation()
    } else if(idx instanceof Page) {
        throw new Error("Pages don't have locations")
    } else if(typeof(idx) === 'string') {
        let path = new Path(idx)
        let res = path.evaluate()
        if(res instanceof Location) {
            return res
        } else {
            let block = new Block(res[":block/uid"])
            return block.toLocation()
        }
    } else {
        throw new TypeError(`Invalid type: ${typeof(idx)}`) 
    }
}

function getDailyNote(date = new Date()) {
    let title = toRoamString(date)
    return getPage(title)
}

function get(idx) {
    let res;
    if(idx instanceof Date) {
        return getDailyNote(idx)
    } else if (res = getBlock(idx)) {
        return res
    } else if (res = getPage(idx)) {
        return res
    } else {
        try {
            return getByPath(idx)
        } catch (e) {
            if(e instanceof ParserError) {
                return null
            }
            throw e
        }
    }
}

async function asyncDailyNote(date = new Date()) {
    let title = toRoamString(date)
    if (Page.exists(title)) {
        return new Promise(res => res(new Page(title)))
    } else {
        return Page.create(title) // returns a promise
    }
}

async function getOpenPage() {
    let obj = await getOpen()
    if (obj instanceof Page) {
        return obj
    } else {
        return obj.getPage()
    }
}


module.exports = { Block, Page, Location, getOpen, getOpenPage, getPage, getBlock, getByPath, get, getDailyNote, asyncDailyNote }