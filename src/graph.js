var { Block, Page, Location, NotFoundError, getById, getByUid, getOpen } = require("./core") 
var { Path } = require("./path") 
var { ParserError } = require("./str") 
var { toRoamString } = require("./date") 

function getByPath(pathString) {
    try {
        let path = new Path(pathString)
        return path.evaluate()
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