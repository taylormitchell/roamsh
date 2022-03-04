let path = require("./path") 
let graph = require("./graph") 
let commands = require("./commands") 
let shell = require("./shell") 
let date = require("./date") 
let configs = require("./configs") 
let util = require("./util") 

// Set up shell
let setUp = () => shell.Shell.setUp()
let tearDown = () => shell.Shell.tearDown()
setUp()

// Create global variables for built-in commands
mv = moveBlock = commands.moveBlock
cp = copyBlock = commands.copyBlock
ln = refBlock = commands.refBlock
rm = deleteBlock = commands.deleteBlock
touch = createBlock = commands.createBlock
ex = toggleBlock = commands.toggleBlock
zm = zoom = commands.zoom 
ls = listChildren = commands.listChildren
lk = linkChildren = commands.linkChildren
echo = commands.echo
cat = commands.cat
run = commands.run
js = commands.js
ud = commands.updateBlock

// Load user commands
commands.loadUserCommands()

module.exports = { path, graph, commands, shell, date, configs, util, ...graph, setUp, tearDown }