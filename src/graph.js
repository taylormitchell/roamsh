var { Block, Page, Location, getById, getByUid } = require("./core") 
var { Path } = require("./path") 
var { toRoamString } = require("./date") 


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
        return new Promise(res => res(new Page(title)))
    } else {
        return Page.create(title) // returns a promise
    }
}

module.exports = { Block, Page, Location, getById, getByUid, getByPath, get, getDailyNote, asyncDailyNote }