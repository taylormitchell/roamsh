let path = require("./path") 
let graph = require("./graph") 
let core = require("./core") 
let commands = require("./commands") 
let terminal = require("./terminal") 
let date = require("./date") 


terminal.App.setUp()


module.exports = { path, graph, commands, terminal, date, core }