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

async function createBlock(string="", dst="") {
    let dstLoc = locationFromPath(dst)
    await Block.create(string, dstLoc)
}

async function deleteBlock(src="^") {
    let block = blockFromPath(src)
    await block.delete()
}

async function moveBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await srcBlock.move(dstLoc)
}

async function copyBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(srcBlock.getString(), dstLoc)
}

async function refBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleExpandBlock(src='^') {
    let block = blockFromPath(src)
    await block.toggleExpand()
}

async function zoom(src='^') {
    let blockOrPage = graph.getByPath(src) 
    await blockOrPage.open()
}

async function echo(string='', dst="/") {
    let dstLoc = locationFromPath(dst)
    await Block.create(string, dstLoc)
}

async function cat(src='^', dst="/") {
    let block = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(block.getString(), dstLoc)
}

async function listChildren(src='^', dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.getString())
    }
}

async function linkChildren(src='^', dst="") {
    let srcBlock = blockFromPath(src)
    let dstBlock = blockFromPath(dst)
    let children = srcBlock.getChildren()
    for (const child of children) {
        await dstBlock.appendChild(child.getRef())
    }
}

async function run(src="^") {
    let codeBlock = blockFromPath(src)
    source = codeBlock.getString().trim() 
      .replace(new RegExp("^" + "`".repeat(3) + ".+"), "")
      .replace(new RegExp("`".repeat(3) + "$"), "")
      .trim();
    return await (async () => eval(source))();
}


module.exports = { createBlock, deleteBlock, moveBlock, copyBlock, refBlock, toggleExpandBlock, zoom, echo, cat, listChildren, linkChildren, run }