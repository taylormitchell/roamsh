var { Selector } = require("./selector") 


function Location(parentUid, order) {
    this.parentUid = parentUid
    this.order = order
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
Block.fromLocation = function (location) {
    parent = new Block(location.parentUid)
    return parent.getChildren()[location.order]
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
Block.prototype = {
    ...Block.prototype,
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
    toggleExpand: async function () {
        await window.roamAlphaAPI.updateBlock(
            {"block": { "uid": this.uid, "open": !this.open }}
         );
    },
    zoom: async function () {
        await window.roamAlphaAPI.ui.mainWindow.openBlock(
            {block: {uid: this.uid}}
        )
    },
    getString: function() {
        let string = window.roamAlphaAPI.q(`[
            :find ?s .
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/string ?s]
        ]`)
        return string
    },
    getOrder: function() {
        let order = window.roamAlphaAPI.q(`[
            :find ?o .
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/order ?o]
        ]`)
        return order
    }, 
    getRefs: function() {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
        ]`)
        return ids.map(id => roam.getById(id))
    },
    getPageRefs: function() {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
                [?r :node/title]
        ]`)
        return ids.map(id => roam.getById(id))
    },
    getBlockRefs: function() {
        let ids = window.roamAlphaAPI.q(`[
            :find [ ?r ... ]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/refs ?r]
                [?r :block/string]
        ]`)
        return ids.map(id => roam.getById(id))
    },
    getChildren: function () {
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
    },
    getParent: function () {
        return this.getParents().slice(-1)[0]
    },
    getParents: function (sorted=true) {
        let parents = window.roamAlphaAPI.q(`[
            :find [(pull ?p [*]) ...]
            :where
                [?e :block/uid "${this.uid}"]
                [?e :block/parents ?p]
        ]`)
        if (sorted) parents = sortParents(parents)
        return parents.map(obj => Roam.getById(obj.id))
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
    getRef: function () {
        return `((${this.uid}))`
    },
    getLocation: function () {
        let parent = this.getParent()
        return new Location(parent.uid, this.order)
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
    getElement: function () {
        blockContentElement = document.querySelector(`[id$="${this.uid}"]:not(.rm-inline-reference [id$="${this.uid}"])`)
        blockContainerElement = blockContentElement.parentElement
        while (!blockContainerElement.classList.contains("roam-block-container")) {
            blockContainerElement = blockContainerElement.parentElement
        }
        return blockContainerElement
    },
    getTextAreaElement: function () {
        return this.getElement().querySelector("textarea")
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
    createDate: function() {
        let timestamp = roamAlphaAPI.q(`[
            :find ?t .
            :where
                [?e :block/uid "${this.uid}"]
                [?e :create/time ?t]
        ]`)
        return new Date(timestamp)
    }
}


function Page(idx) {
    if (idx instanceof Page) {
        // Handle idx as page object
        this.uid = idx.uid
        return
    } else if (typeof(idx) === "number") {
        // Handle idx as internal id
        let obj = window.roamAlphaAPI.pull("[*]", idx)
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


function SelectorInterpreter(selector) {
    if (!(selector instanceof Selector)) {
        selector = new Selector(selector)
    }
    this.selector = selector
}
SelectorInterpreter.prototype.error = function(message, token) {
    if (token) {
        string = this.selector.string
        pointer = " ".repeat(token.index) + "^".repeat(token.lexeme.length)
        message += "\n\n" + string + "\n" + pointer
    }
    throw LocationNotFound(message)
}
SelectorInterpreter.prototype.evaluate = function() {
    // Get starting object
    var node;
    switch (this.selector.start.type) {
        case Selector.START_TYPE.ROOT:
            throw new LocationNotFound(`No support for selectors starting at ${selector.start} yet :(`);
        case Selector.START_TYPE.PARENT:
            node = Block.getFocused()
            for (var i = 0; i < this.selector.start.length; i++) {
                node = block.getParent();
            }
            break;
        case Selector.START_TYPE.FOCUSED:
            node = Block.getFocused();
            break;
        case Selector.START_TYPE.PAGE:
            node = new Page(this.selector.start.lexeme);
            break;
        case Selector.START_TYPE.BLOCK:
            node = new Block(this.selector.start.lexeme);
            break;
        default:
            throw new LocationNotFound(`Invalid selector start: ${this.selector.start}`);
    }

    // Traverse path
    for (var searchString of this.selector.path) {
        let res = node.getChildren().filter(({ string }) => string === searchString)
        if (res.length === 0) {
            throw new LocationNotFound(`"${searchString}" doesn't match any children of ${node.uid}`)
        }
        node = res[0]
    }

    // Traverse offset
    var location;
    for (var offset of this.selector.offset) {
        if (location) {
            throw `Can't apply offset once selector reaches `+
                  `new location: ${offset.lexeme} at index ${offset.index}`
        }
        switch (offset.type) {
            case Selector.OFFSET_TYPE.SIBLING:
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
            case Selector.OFFSET_TYPE.CHILD:
                let childNum = offset.value
                let children = node.getChildren()
                if (children.length === 0) {
                    if (childNum >= 1) {
                        this.error('Child selector index must be <=0 when node has no children', token);
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

// Helpers


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

function querySelector(selectorString) {
    selector = new Selector(selectorString)
    interpreter = new SelectorInterpreter(selector)
    return interpreter.evaluate()
}


module.exports = { Block, Page, Location, getById, getByUid, querySelector}