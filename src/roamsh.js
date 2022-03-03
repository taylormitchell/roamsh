let path = require("./path") 
let graph = require("./graph") 
let commands = require("./commands") 
let terminal = require("./terminal") 
let date = require("./date") 
let configs = require("./configs") 
let util = require("./util") 

// Set up terminal
terminal.Terminal.setUp()

// Create global variables for built-in commands
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
js = commands.js
ud = commands.updateBlock

// Load user commands defined in configs.ROAMSH_PATHS
commands.loadUserCommands()

module.exports = { path, graph, commands, terminal, date, configs, util, ...graph }