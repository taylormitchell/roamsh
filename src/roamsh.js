let path = require("./path") 
let graph = require("./graph") 
let core = require("./core") 
let { Block, Page, Location } = require("./core") 
let commands = require("./commands") 
let terminal = require("./terminal") 
let date = require("./date") 
let configs = require("./configs") 


terminal.App.setUp()

mv = moveBlock = commands.moveBlock
cp = copyBlock = commands.copyBlock
ln = refBlock = commands.refBlock
rm = deleteBlock = commands.deleteBlock
mk = createBlock = commands.createBlock
ex = toggleBlock = commands.toggleBlock
zm = zoom = commands.zoom 
ls = listChildren = commands.listChildren
lk = linkChildren = commands.linkChildren
echo = commands.echo
cat = commands.cat
run = commands.run

module.exports = { path, graph, commands, terminal, date, core, configs, ...core}