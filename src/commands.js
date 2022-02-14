let { Block, Page, Location } = require('./graph');
let graph = require('./graph');


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

async function createBlock(string, dst="") {
    let dstLoc = locationFromPath(dst)
    return Block.create(string, dstLoc)
}

async function deleteBlock(src) {
    let block = blockFromPath(src)
    return block.delete()
}

async function moveBlock(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    return srcBlock.move(dstLoc)
}

async function copyBlock(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    return Block.create(srcBlock.string, dstLoc)
}

async function refBlock(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    return Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleExpandBlock(src) {
    let block = blockFromPath(src)
    return block.toggleExpand()
}

async function zoomBlock(src) {
    let block = blockFromPath(src)
    return block.zoom()
}

async function echo(string, dst="") {
    let dstBlock = blockFromPath(dst)
    return dstBlock.addChild(string)
}

async function cat(src, dst="") {
    let block = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    return dstBlock.addChild(block.string)
}

async function listChildren(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.string)
    }
}

async function linkChildren(src, dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
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