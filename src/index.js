let path = require("./path") 
let graph = require("./graph") 
let core = require("./core") 
let commands = require("./commands") 
let terminal = require("./terminal") 
let date = require("./date") 


terminal.App.setUp()

mv = commands.moveBlock
cp = commands.copyBlock
ln = commands.refBlock
rm = commands.deleteBlock
mk = commands.createBlock
ex = commands.toggleExpandBlock
zm = commands.zoom 
ls = commands.listChildren
lk = commands.linkChildren
echo = commands.echo
cat = commands.cat
run = commands.run


module.exports = { path, graph, commands, terminal, date, core }