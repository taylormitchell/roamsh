let { RoamResearchShell } = require('./shell');
let { Block, Page, Roam } = require('./graph');
// let { mv, cp, ln, rm, mk, ex, zm, ls, lk, echo, cat } = require('./commands');

const TERM_LABEL = "roamsh: Terminal"
const TERM_ATTR = "roamshTermListener"
const CSS_ID = "roam-term"
const CSS = `
.roamTerm .rm-block-text
{
    background-color: rgb(235, 232, 232);
    border-radius: 0 5px 5px 0;
}

.roamTerm .prompt-prefix-area {
    background-color: rgb(235, 232, 232);
    display: flex;
    flex: 0 0 35px;
    margin-top: -1px;
    height: 29px;
    padding-top: 4px;
    padding-left: 4px;
    border-radius: 5px 0 0 5px;

}
`
PAGE_NAME_HISTORY = typeof(PAGE_NAME_HISTORY) === "undefined" ? "RoamTerm_history" : PAGE_NAME_HISTORY


function RoamTerm(block) {
    this.block = block
    this.uid = this.block.uid
    this.current = ""
    this.commandHistory = []
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
    isEmpty: function() {
        return this.getString() === ""
    },
    getString: function () {
        if (this.block.exists()) {
            return this.block.getTextAreaElement().value
        }
        return ""
    },
    activate: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.add("roamTerm")
        promptPrefix = new PromptPrefix("~ %")
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", promptPrefix.toElement())
        this.historyNavListener = this.historyNavListener.bind(this)
        termElement.addEventListener("keydown", this.historyNavListener)
    },
    deactivate: function() {
        if (!this.block.exists()) {
            return
        }
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
        let prefix = termElement.querySelector(".prompt-prefix-area")
        if (prefix) prefix.remove()
        termElement.removeEventListener("keydown", this.historyNavListener)
    },
    execute: async function () {
        let textarea = this.block.getTextAreaElement()
        let source = textarea.value
        this.commandHistory.push(source)
        await this.block.update("")
        try {
            eval(source)
            // rrsh = new RoamResearchShell()
            // rrsh.run(source)
        } catch (error) {
            this.block.addChild(error.toString())
            throw error
        }
        // for (const out of outputs) {
        //     await this.block.addChild(await out)
        // }
        this.commandHistoryId = 0
    },
    updateToPrevious: function() {
        if (this.commandHistoryId <= -this.commandHistory.length) {
            this.commandHistoryId = -this.commandHistory.length
            return
        }
        if (this.commandHistoryId === 0) {
            this.current = this.getString()
        }
        this.commandHistoryId = this.commandHistoryId - 1
        previous = this.commandHistory.slice(this.commandHistoryId)[0]
        this.block.update(previous)
    },
    updateToNext: function() {
        let next;
        if (this.commandHistoryId < -1) {
            this.commandHistoryId = this.commandHistoryId + 1
            next = this.commandHistory.slice(this.commandHistoryId)[0]
        } else if (this.commandHistoryId === -1) {
            this.commandHistoryId = this.commandHistoryId + 1
            next = this.current
        } else {
            this.commandHistoryId = 0;
            next = ""
        }
        this.block.update(next)
    },
    historyNavListener: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="ArrowUp") {
            this.updateToPrevious()
        }
        if (e.ctrlKey && e.metaKey && e.key==="ArrowDown") {
            this.updateToNext()
        }
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


App = {
    prompts: {},
    setUp: function() {
        this.addStyle()
        this.addCommand()
        this.addListener()
    },
    tearDown: function() {
        for (let [uid, prompt] of Object.entries(this.prompts)) {
            this.deactivatePrompt(prompt)
        }
        this.removeCommand()
        this.removeListener()
    },
    getPrompt: function(block) {
        let roamTerm = this.prompts[block.uid]
        if (!roamTerm) {
            roamTerm = new RoamTerm(block)
            this.prompts[block.uid] = roamTerm
        }
        return roamTerm
    },
    activatePrompt: function(roamTerm) {
        roamTerm.activate()
        this.prompts[roamTerm.block.uid] = roamTerm
    },
    deactivatePrompt: function(roamTerm) {
        roamTerm.deactivate()
        delete this.prompts[roamTerm.block.uid]
    },
    togglePrompt: function(block) {
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            this.deactivatePrompt(roamTerm)
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    addStyle: function() {
        let el = document.getElementById(CSS_ID);
        if (el) {
            return el
        }
        el = document.createElement("style");
        el.textContent = CSS;
        el.id = CSS_ID
        document.getElementsByTagName("head")[0].appendChild(el);
        return el;
    },
    command: function() {
        let block = Block.getFocused()
        this.togglePrompt(block)
    },
    hotkeyListener: function(e) {
        if (e.key === "Backspace") {
            let b = Block.getFocused()
            let roamTerm = this.getPrompt(b)
            if (roamTerm.isEmpty()) {
                this.deactivatePrompt(roamTerm)
            }
        }
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let b = Block.getFocused()
            let roamTerm = this.getPrompt(b)
            if (roamTerm.isActive()) {
                if (!roamTerm.isEmpty()) {
                    roamTerm.execute()
                } else {
                    roamTerm.deactivate()
                }
            } else {
                roamTerm.activate()
            }
        }
    },
    addCommand: function() {
        this.command = this.command.bind(this)
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: TERM_LABEL, 
            callback: this.command    
        })
    },
    removeCommand: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: TERM_LABEL})
    },
    addListener: function() {
        this.hotkeyListener = this.hotkeyListener.bind(this)
        const roamApp = document.querySelector(".roam-app") 
        if (roamApp.dataset[TERM_ATTR] === "true") {
            return
        }
        roamApp.addEventListener("keydown", this.hotkeyListener) 
        roamApp.dataset[TERM_ATTR] = "true"
    },
    removeListener: function() {
        const roamApp = document.querySelector(".roam-app") 
        roamApp.dataset[TERM_ATTR] = "false"
        roamApp.removeEventListener("keydown", this.hotkeyListener)
    },
}


module.exports = { App }