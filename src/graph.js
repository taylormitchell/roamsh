var { Block, Page, Location, getById, getByUid } = require("./core") 
var { Path } = require("./path") 


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

module.exports = { Block, Page, Location, getById, getByUid, getByPath, get }