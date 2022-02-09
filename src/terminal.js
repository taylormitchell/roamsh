let { RoamResearchShell } = require('./shell');
let { Block, Page, Roam, mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat } = require('./core');


PAGE_NAME_HISTORY = typeof(PAGE_NAME_HISTORY) === "undefined" ? "RoamTerm_history" : PAGE_NAME_HISTORY



function RoamTerm(block) {
    this.block = block
    this.uid = this.block.uid
    this.commandHistoryId = 0
}
RoamTerm.getFocused = function() {
    let block = Block.getFocused()
    if (!block) return null
    return new RoamTerm(block)
}
RoamTerm.prototype = {
    ...RoamTerm.prototype,
    isActive: function() {
        termElement = this.block.getElement()
        return termElement.querySelector(".rm-block-main").classList.contains("roamTerm")
    },
    activate: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.add("roamTerm")
        promptPrefix = new PromptPrefix("~ %")
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", promptPrefix.toElement())
    },
    deactivate: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
        termElement.querySelector(".prompt-prefix-area").remove()
    },
    execute: async function () {
        let textarea = this.block.getTextAreaElement()
        let source = textarea.value
        commandHistory.addToEnd(source)
        await this.block.update("")
        try {
            rrsh = new RoamResearchShell()
            rrsh.run(source)
        } catch (error) {
            this.block.addChild(error.toString())
            throw error
        }
        // for (const out of outputs) {
        //     await this.block.addChild(await out)
        // }
    },
    string: function () {
        return this.block.getTextAreaElement().value
    }
}


function PromptPrefix(string) {
    this.string = string
}
PromptPrefix.prototype = {
    ...PromptPrefix.prototype,
    toElement: function () {
        prefixArea = document.createElement("div")
        prefixArea.classList.add("prompt-prefix-area")
        prefixContent = document.createElement("div")
        prefixContent.classList.add("prompt-prefix-str")
        prefixStr = document.createElement("span")
        prefixStr.innerText = this.string
        prefixContent.appendChild(prefixStr)
        prefixArea.appendChild(prefixContent)
        return prefixArea
    }
}


commandHistory = {
    pageName: PAGE_NAME_HISTORY,
    getFromEnd: function(numFromEnd=-1) {
        p = new Page(this.pageName)
        string = p.getChildren().slice(numFromEnd)[0].string
        commandLines = string.split("\n").slice(1)
        commandLines[commandLines.length - 1] = commandLines.slice(-1)[0].slice(0,-3)
        return commandLines.join("\n")
    },
    addToEnd: function(command) {
        let p = new Page(this.pageName)
        string = "`".repeat(3)+"plain text" + "\n" + command+"`".repeat(3)
        p.appendChild(string)
    }
}

document.addEventListener("onkeydown", (e) => {
    if (e.key === "Backspace") {
        let roamTerm = RoamTerm.getFocused()
        if (roamTerm !== null && roamTerm.isActive() && !roamTerm.string()) {
            roamTerm.deactivate()
        }
    }
    else if (e.ctrlKey && e.metaKey && e.key == "Enter") {
        let b = Block.getFocused()
        let roamTerm = new RoamTerm(b)
        if (roamTerm.isActive()) {
            if (roamTerm.string()) {
                roamTerm.execute()
                roamTerm.commandHistoryId = 0
            } else {
                roamTerm.deactivate()
            }
        } else {
            roamTerm.activate()
        }
    }
    else if (e.ctrlKey && e.metaKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
        let b = Block.getFocused()
        let roamTerm = new RoamTerm(b)
        if (roamTerm.isActive()) {
            if (e.key == "ArrowUp") {
                roamTerm.commandHistoryId = roamTerm.commandHistoryId - 1
            } else {
                roamTerm.commandHistoryId = roamTerm.commandHistoryId >= -1 ? -1 : roamTerm.commandHistoryId + 1
            }
            oldCommand = commandHistory.getFromEnd(roamTerm.commandHistoryId)
            roamTerm.block.update(oldCommand)
        }
    }
})


//if (typeof document !== "undefined") {
//    document.onkeydown = function (e) {
//        if (e.key === "Backspace") {
//            let roamTerm = RoamTerm.getFocused()
//            if (roamTerm !== null && roamTerm.isActive() && !roamTerm.string()) {
//                roamTerm.deactivate()
//            }
//        }
//        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
//            let b = Block.getFocused()
//            let roamTerm = new RoamTerm(b)
//            if (roamTerm.isActive()) {
//                if (roamTerm.string()) {
//                    roamTerm.execute()
//                    roamTerm.commandHistoryId = 0
//                } else {
//                    roamTerm.deactivate()
//                }
//            } else {
//                roamTerm.activate()
//            }
//        }
//        if (e.ctrlKey && e.metaKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
//            let b = Block.getFocused()
//            let roamTerm = new RoamTerm(b)
//            if (roamTerm.isActive()) {
//                if (e.key == "ArrowUp") {
//                    roamTerm.commandHistoryId = roamTerm.commandHistoryId - 1
//                } else {
//                    roamTerm.commandHistoryId = roamTerm.commandHistoryId >= -1 ? -1 : roamTerm.commandHistoryId + 1
//                }
//                oldCommand = commandHistory.getFromEnd(roamTerm.commandHistoryId)
//                roamTerm.block.update(oldCommand)
//            }
//
//        }
//    };
//}
//
//