let { isBlockRef, isPageRef, isBlockUid } = require("./str")


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
            {"block": { "uid": this.uid, "open": !this.open }}
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
    let uid = window.roamAlphaAPI.util.generateUID()
    await window.roamAlphaAPI.createPage({page: {title: title, uid: uid}})
    return Page(uid)
}
Page.getOpen = async function() {
    let obj = await getOpen()
    if (obj instanceof Block) {
        return obj.getPage()
    }
    return obj
}
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