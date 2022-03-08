

function getByIdx(idx) {
    // idx is :db/id
    if(typeof(idx) === 'number') {
        return getById(idx)
    // idx is :block/uid
    } else if(typeof(idx) === 'string') {
        return getByUid(idx)
    // idx is already {:block/uid, :block/string, ...}
    } else if(typeof(idx) === 'object') {
        return idx
    }
}

function getById(id) {
    return roamAlphaAPI.pull("[*]", id)
}

function getByUid(uid) {
    let id = roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :block/uid "${uid}"]
    ]`)
    return getById(id)
}

function getByTitle(title) {
    let id = roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :node/title "${title}"]
    ]`)
    return getById(id)
}

function getParents(idx, sorted=true) {
    let block = getByIdx(idx)
    let parents = (block[":block/parents"]||[]).map(p => roamAlphaAPI.pull("[*]", p[":db/id"]))
    if (sorted) parents = sortParents(parents)
    return parents
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
        if ((last[":block/children"]||[]).map(obj => obj[":db/id"]).includes(parent[":db/id"])) {
            // parent is a child of the last sorted node
            sortedParents.push(parent);
        } else if ((parent[":block/children"]||[]).map(obj => obj[":db/id"]).includes(first[":db/id"])) {
            // parent is parent of the first sorted node
            sortedParents = [parent].concat(sortedParents)
        } else {
            parents.push(parent)
        }
        count += 1
    }
    return sortedParents
}

function getParent(idx) {
    let block = getByIdx(idx)
    return getParents(block, true).slice(-1)[0]
}

function getChildren(idx, sorted=true) {
    let block = getByIdx(idx)
    let children = (block[":block/children"]||[]).map(o => roamAlphaAPI.pull("[*]", o[":db/id"]))
    if(sorted) {
        children = children.sort((x,y) => x[":block/order"] - y[":block/order"])
    }
    return children
}

function getSiblings(idx) {
    let block = getByIdx(idx)
    let parent = getParent(block)
    return getChildren(parent)
}

function getOrder(uid) {
    return getProperty(uid, "order")
}

function getString(uid) {
    return getProperty(uid, "string")
}

function getFocused() {
    let res = roamAlphaAPI.ui.getFocusedBlock()
    if(res) {
        return getByUid(res['block-uid'])
    }
    let uid = elementToBlockUid(document.activeElement)
    if(uid) {
        return getByUid(uid)
    }
    return null
}

function isPage(idx) {
    let obj = getByIdx(idx)
    return obj[":node/title"] ? true : false
}

function isBlock(idx) {
    let obj = getByIdx(idx)
    return !isPage(obj)
}

function getProperty(uid, name, namespace="block") {
    return window.roamAlphaAPI.q(`[
        :find ?v .
        :where
            [?e :block/uid "${uid}"]
            [?e :${namespace}/${name} ?v]
    ]`)
}

function getPropertyList(uid, name, namespace="block") {
    return window.roamAlphaAPI.q(`[
        :find [ ?v ... ]
        :where
            [?e :block/uid "${uid}"]
            [?e :${namespace}/${name} ?v]
    ]`)
}

function uidToId(uid) {
    return window.roamAlphaAPI.q(`[
        :find ?e .
        :where
            [?e :block/uid "${uid}"]
    ]`)
}


function elementToBlockUid(el) {
    while(el && !(el.classList.contains("roam-block"))) {
        el = el.parentElement 
    }
    if(!el || !el.id) return null
    if(el.id.startsWith("block-input")) {
        return el.id.slice(-9) 
    }
    return null
}

function Location(parentUid, order) {
    this.parentUid = parentUid
    this.order = order
}

function NotFoundError(message) {
    instance = new Error(message);
    instance.name = 'NotFoundError';
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) {
        Error.captureStackTrace(instance, NotFoundError);
      }
    return instance;
}
NotFoundError.prototype = Object.create(Error.prototype)
NotFoundError.prototype.constructor = NotFoundError

module.exports = {getParents, getParent, getChildren, getSiblings, getOrder, isBlock, isPage, uidToId, getString, getFocused, sortParents, Location, NotFoundError, elementToBlockUid, getByTitle, getByUid, getById}

