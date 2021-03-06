let { Block, Page, Location } = require('./graph');
let graph = require('./graph');
let configs = require('./configs');
const { Script } = require('./shell');


function argToLocation(arg) {
    // Get node from arg
    let node;
    if(arg instanceof Location) {
        return arg 
    } else if(arg instanceof Page) {
        throw `Can't get Location from Page`
    } else if(arg instanceof Block) {
        node = arg
    } else {
        node = graph.getByPath(arg.toString())
    }
    // Get location from node
    if (node instanceof Block) {
        return new Location(node.getParent().uid, node.getOrder())
    } else if (node instanceof Location) {
        return node
    } else if (node instanceof Page) {
        throw `Argument must be a Page or a Path to a Page. `
              `The given path "${arg}" lead to a node of type ${typeof(arg)}.`
    } else {
        throw `Can't get location from type ${typeof(node)}`
    }
}

function argToBlock(arg) {
    let node;
    if(arg instanceof Block) {
        return arg
    } else if(arg instanceof Location) {
        return new Block(arg)
    } else if(typeof(arg) === 'string') {
        node = graph.getByPath(arg)
        if(node instanceof Block) {
            return node
        } else if(node instanceof Location) {
            throw new Error(`Argument must be a Block or a path to a block. The given path "${arg}" doesn't lead to an existing block`)
        }
        throw new Error(`Argument must be a Block or a path to a block. The given path "${arg}" lead to a node of type ${typeof(node)}.`)
    } else {
        throw new Error(`Argument must be a Block or a path to a block. The given arg "${arg}" has type ${typeof(arg)}.`)
    }
}

// Commands

async function createBlock(string="", dst="/") {
    let dstLoc = argToLocation(dst)
    await Block.create(string.toString(), dstLoc)
}

async function deleteBlock(src="^") {
    let block = argToBlock(src)
    await block.delete()
}

async function moveBlock(src="^", dst="/") {
    let srcBlock = argToBlock(src)
    let dstLoc = argToLocation(dst)
    await srcBlock.move(dstLoc)
}

async function copyBlock(src="^", dst="/", opts = {recursive: true}) {
    let srcBlock = argToBlock(src)
    let dstLoc = argToLocation(dst)
    await srcBlock.copy(dstLoc, opts)
}

async function updateBlock(string, dst="^") {
    if(!string) {
        throw new Error("Missing string argument")
    }
    let dstBlock = argToBlock(dst)
    await dstBlock.update(string)
}

async function refBlock(src="^", dst="/") {
    let srcBlock = argToBlock(src)
    let dstLoc = argToLocation(dst)
    await Block.create(srcBlock.toRef(), dstLoc)
}

async function toggleBlock(src='^') {
    let block = argToBlock(src)
    await block.toggleExpand()
}

async function zoom(src='^') {
    let blockOrPage = graph.getByPath(src) 
    await blockOrPage.open()
}

async function echo(string) {
    let block = Block.getFocused()
    await block.appendChild(string)
}

async function cat(src='^') {
    let block = argToBlock(src)
    return block.getString()
    //let dstLoc = argToLocation(dst)
    //let newBlock = await Block.create(block.getString(), dstLoc)
    //return newBlock.toRef()
}

async function listChildren(src='^', dst='/', opts = {recursive: true}) {
    let srcBlock = argToBlock(src)
    let dstLoc = argToLocation(dst)
    await srcBlock.copyChildren(dstLoc, opts)
}

async function linkChildren(src='^', dst='/', opts = {recursive: true}) {
    opts.reference = true;
    return await listChildren(src, dst, opts)
}

async function run(src="^") {
    let block = argToBlock(src)
    let codeBlock = new Script(block)
    if(codeBlock.getLanguage() !== 'javascript') {
        throw new Error('Only javascript code blocks are supported')
    }
    let [code, result] = await codeBlock.execute()
    return result
}

async function js(code = "") {
    return await (async () => eval(code))();
}

// Run all code blocks under user paths
function loadUserCommands(recursive=true) {
    function runScriptsBelow(node, recursive=true) {
        for(let child of node.getChildren()) {
            let script;
            try {
                // The Script constructor will raise an error 
                // if the block isn't a script 
                script = new Script(child)
            } catch(e) {}
            if(script) script.execute()
            if(recursive) {
                runScriptsBelow(child)
            }
        }
    }
    for(let path of configs.ROAMSH_PATHS) {
        let node = graph.getByPath(path)
        if(node instanceof Location) continue
        runScriptsBelow(node, recursive)
    }
}


module.exports = { createBlock, deleteBlock, moveBlock, copyBlock, refBlock, toggleBlock, zoom, echo, cat, listChildren, linkChildren, run, loadUserCommands, argToLocation, argToBlock, js, updateBlock }