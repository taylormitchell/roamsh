let { Block, Page, Location } = require('./graph');
let graph = require('./graph');


function locationFromSelector(selector) {
    var res = graph.querySelector(selector)
    if (res instanceof Page) {
        throw `Destination can't be a page: ${selector}`
    } else if (res instanceof Block) {
        return new Location(res.getParent().uid, res.getOrder())
    } else {
        return res
    }
}

function blockFromSelector(selector) {
    var res = graph.querySelector(selector) 
    if (!(res instanceof Block)) {
        throw `Not a block: ${selector}`
    }
    return res
}

// Commands

async function createBlock(string, dst="") {
    let dstLoc = locationFromSelector(dst)
    return Block.create(string, dstLoc)
}

async function deleteBlock(src) {
    let block = blockFromSelector(src)
    return block.delete()
}

async function moveBlock(src, dst="") {
    let srcBlock = blockFromSelector(src)
    let dstLoc = locationFromSelector(dst)
    return srcBlock.move(dstLoc)
}

async function copyBlock(src, dst="") {
    let srcBlock = blockFromSelector(src)
    let dstLoc = locationFromSelector(dst)
    return Block.create(srcBlock.string, dstLoc)
}

async function refBlock(src, dst="") {
    let srcBlock = blockFromSelector(src)
    let dstLoc = locationFromSelector(dst)
    return Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleExpandBlock(src) {
    let block = blockFromSelector(src)
    return block.toggleExpand()
}

async function zoomBlock(src) {
    let block = blockFromSelector(src)
    return block.zoom()
}

async function echo(string, dst="") {
    let dstBlock = blockFromSelector(dst)
    return dstBlock.addChild(string)
}

async function cat(src, dst="") {
    let block = blockFromSelector(src)
    let dstBlock = blockFromSelector(dst)
    return dstBlock.addChild(block.string)
}

async function listChildren(src, dst="") {
    let srcBlock = blockFromSelector(src)
    let dstBlock = blockFromSelector(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.string)
    }
}

async function linkChildren(src, dst="") {
    let srcBlock = blockFromSelector(src)
    let dstBlock = blockFromSelector(dst)
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

module.exports = { mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat }