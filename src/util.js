

function getParents(uid, sorted=true) {
    let parents = window.roamAlphaAPI.q(`[
        :find [(pull ?p [*]) ...]
        :where
            [?e :block/uid "${uid}"]
            [?e :block/parents ?p]
    ]`)
    if (sorted) parents = sortParents(parents)
    return parents.map(obj => obj.uid)
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

function getParent(uid) {
    return this.getParents(uid).slice(-1)[0]
}

function getChildren(uid, sorted=true) {
    let uids = window.roamAlphaAPI.q(`[
        :find [ ?uids ... ]
        :where
            [?e :block/uid "${uid}"]
            [?e :block/children ?c]
            [?c :block/uid ?uids]
    ]`)
    if(sorted) {
        uids = uids.sort((x,y) => getOrder(x) - getOrder(y))
    }
    return uids
}

function getSiblings(uid) {
    let parentUid = this.getParent(uid)
    return this.getChildren(parentUid)
}

function getOrder(uid) {
    return getProperty(uid, "order")
}

function getString(uid) {
    return getProperty(uid, "string")
}

function getFocused(uid) {
    return roamAlphaAPI.ui.getFocusedBlock()["block-uid"]
}

function isBlock(uid) {
    let res = getProperty(uid, "title", "node")
    return res === null
}

function isPage(uid) {
    let res = getProperty(uid, "title", "node")
    return res !== null
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

module.exports = {getParents, getParent, getChildren, getSiblings, getOrder, isBlock, isPage, uidToId, getString, getFocused, sortParents, Location, NotFoundError}

