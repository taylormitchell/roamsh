let { Block, Page, Location } = require('./graph');
let graph = require('./graph');
let configs = require('./configs');


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

async function copyBlock(src="^", dst="", opts = {recursive: true}) {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    // await Block.create(srcBlock.getString(), dstLoc)
    await srcBlock.copy(dstLoc, opts)
}

async function refBlock(src="^", dst="") {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await Block.create(srcBlock.getRef(), dstLoc)
}

async function toggleBlock(src='^') {
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

async function listChildren(src='^', dst='/', opts = {recursive: true}) {
    let srcBlock = blockFromPath(src)
    let dstLoc = locationFromPath(dst)
    await srcBlock.copyChildren(dstLoc, opts)
}

async function linkChildren(src='^', dst="/", opts = {recursive: true}) {
    opts.reference = true;
    listChildren(src, dst, opts)
}

async function run(src="^") {
    let codeBlock = blockFromPath(src)
    source = codeBlock.getString().trim() 
      .replace(new RegExp("^" + "`".repeat(3) + ".+"), "")
      .replace(new RegExp("`".repeat(3) + "$"), "")
      .trim();
    return await (async () => eval(source))();
}

// Run all code blocks under user paths
function loadUserCommands(recursive=true) {
    function isCodeBlock(node) {
        string = node.getString()
        return string.startsWith('`'.repeat(3) + 'javascript') &&
               string.endsWith('`'.repeat(3))
    }

    function runCommandsBelow(node, recursive=true) {
        for(let child of node.getChildren()) {
            if(isCodeBlock(child)) {
              run(child.getRef())
            }
            if(recursive) {
              runCommandsBelow(child)
            }
        }
    }

    for(let path of configs.ROAMSH_PATHS) {
        let node = graph.get(path)
        if(!node) continue
        runCommandsBelow(node, recursive)
    }
}
loadUserCommands()


module.exports = { createBlock, deleteBlock, moveBlock, copyBlock, refBlock, toggleBlock, zoom, echo, cat, listChildren, linkChildren, run, loadUserCommands }