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
    this.observer = null;
}
RoamTerm.getFocused = function() {
    let block = Block.getFocused()
    if (!block) return null
    return new RoamTerm(block)
}
RoamTerm.prototype = {
    ...RoamTerm.prototype,
    // Verbs
    activate: function() {
        if (this.isActive()) return
        this.addHTML()
        this.addHotkeyListener()
        this.connectObserver()
    },
    deactivate: function() {
        if (!this.isActive()) return
        this.removeHTML()
        this.removeHotkeyListener()
        this.disconnectObserver()
    },
    execute: async function () {
        let textarea = this.block.getTextAreaElement()
        let source = textarea.value
        this.commandHistory.push(source)
        await this.block.update("")
        let res;
        try {
            res = await (async () => eval(source))()
            if (res) await this.block.addChild(res.toString())
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
    hotkeyCallback: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="Enter") {
            if (!this.isEmpty()) this.execute()
        }
        if (e.ctrlKey && e.metaKey && e.key==="ArrowUp") {
            this.updateToPrevious()
        }
        if (e.ctrlKey && e.metaKey && e.key==="ArrowDown") {
            this.updateToNext()
        }
    },
    addHotkeyListener: function() {
        let el = this.block.getElement()
        this.hotkeyCallback = this.hotkeyCallback.bind(this)
        el.addEventListener("keydown", this.hotkeyCallback)
    },
    removeHotkeyListener: function() {
        let el = this.block.getElement()
        el.removeEventListener("keydown", this.hotkeyCallback)
    },
    addHTML: function() {
        let termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.add("roamTerm")
        let prefix = new PromptPrefix("~ %")
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", prefix.toElement())
        this.update()

    },
    removeHTML: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
        let prefix = termElement.querySelector(".prompt-prefix-area")
        if (prefix) prefix.remove()
    },
    // Properties
    blockExists: function() {
        return this.block.exists()
    },
    blockInView: function() {
        return this.block.getElement() !== null
    },
    blockIsFocused: function() {
        return this.block.isFocused()
    },
    isActive: function() {
        if (!this.blockExists()) return false
        if (!this.blockInView()) return false
        termElement = this.block.getElement()
        return termElement.querySelector(".rm-block-main").classList.contains("roamTerm")
    },
    isEmpty: function() {
        return this.getString() === ""
    },
    getString: function () {
        if (this.blockIsFocused()) {
            return this.block.getTextAreaElement().value
        } else {
            return this.block.getElement().innerText
        }
    },
    // Maintain UI
    update: function() {
        this.current = this.getString()
        let prefix = this.getPrefixElement()
        let input = this.getInputElement() 
        prefix.style.height = input.style.height 
    },
    connectObserver: function() {
        const targetNode = this.block.getElement();
        const config = { childList: true, subtree: true };
        this.update = this.update.bind(this)
        this.observer = new MutationObserver(this.update);
        this.observer.observe(targetNode, config);
    },
    disconnectObserver: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    getPrefixElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".prompt-prefix-area") : null
    },
    getInputElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".rm-block__input") : null
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
    observer: null,
    // Prompt stuff
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
        if (this.count() === 1) {
            this.connectObserver()
        }
    },
    deactivatePrompt: function(roamTerm) {
        roamTerm.deactivate()
        delete this.prompts[roamTerm.block.uid]
        if (this.count() === 0) {
            this.disconnectObserver()
        }
    },
    executePrompt: function(roamTerm) {
        roamTerm.execute()
    },
    togglePrompt: function(block) {
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            this.deactivatePrompt(roamTerm)
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    togglePromptOrExecute: function(block) {
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            if (!roamTerm.isEmpty()) {
                this.executePrompt(roamTerm)
            } else {
                this.deactivatePrompt(roamTerm)
            }
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    // Maintain UI and state
    update: function() {
        for(let [uid, prompt] of Object.entries(this.prompts)) {
            if (!prompt.blockExists()) {
                this.deactivatePrompt(prompt)
            } else if (!prompt.isActive() && prompt.blockInView()) {
                this.activatePrompt(prompt)
            }
        }
    },
    connectObserver: function() {
        const targetNode = document.querySelector('.roam-article');
        const config = { childList: true, subtree: true };
        this.update = this.update.bind(this)
        this.observer = new MutationObserver(this.update);
        this.observer.observe(targetNode, config);
    },
    disconnectObserver: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    // Set up and tear down  
    setUp: function() {
        this.addStyle()
        this.addCommandToPallete()
        this.addHotkeyListener()
    },
    tearDown: function() {
        for (let [uid, prompt] of Object.entries(this.prompts)) {
            this.deactivatePrompt(prompt)
        }
        this.removeCommandFromPallete()
        this.removeHotkeyListener()
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
    commandPaletteCallback: function() {
        let block = Block.getFocused()
        const roamTerm = this.getPrompt(block)
        if (roamTerm.isActive()) {
            this.deactivatePrompt(roamTerm)
        } else {
            this.activatePrompt(roamTerm)
        }
    },
    hotkeyCallback: function(e) {
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let block = Block.getFocused()
            const roamTerm = this.getPrompt(block)
            if (roamTerm.isActive() && roamTerm.isEmpty()) {
                this.deactivatePrompt(roamTerm)
            } else {
                this.activatePrompt(roamTerm)
            }
        }
    },
    addCommandToPallete: function() {
        this.commandPaletteCallback = this.commandPaletteCallback.bind(this)
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: TERM_LABEL, 
            callback: this.commandPaletteCallback    
        })
    },
    removeCommandFromPallete: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: TERM_LABEL})
    },
    addHotkeyListener: function() {
        this.hotkeyCallback = this.hotkeyCallback.bind(this)
        const roamApp = document.querySelector(".roam-app") 
        roamApp.addEventListener("keydown", this.hotkeyCallback) 
    },
    removeHotkeyListener: function() {
        const roamApp = document.querySelector(".roam-app") 
        roamApp.removeEventListener("keydown", this.hotkeyCallback)
    },
    // Helpers
    count: function() {
        return Object.keys(this.prompts).length
    },
}








module.exports = { App }