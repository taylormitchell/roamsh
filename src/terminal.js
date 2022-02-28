let { RoamResearchShell } = require('./shell');
let { Block, Page, Roam } = require('./graph');
const configs = require('./configs');


CommandInterpreters = {
    "js": async (source) => eval(source),
    "rrsh": async function (source) {
        let rrsh = new RoamResearchShell()
        return await rrsh.run(source)
    } 
}

function Prompt(block) {
    this.block = block
    this.uid = this.block.uid
    this.current = ""
    this.commandHistory = []
    this.commandHistoryId = 0
    this.observer = null;
    this.interpret = CommandInterpreters[configs.ROAMSH_INTERPRETER]
}
Prompt.getFocused = function() {
    let block = Block.getFocused()
    if (!block) return null
    return new Prompt(block)
}
Prompt.prototype = {
    ...Prompt.prototype,
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
        let command = this.getCommand()
        this.commandHistory.push(command)
        this.commandHistoryId = 0
        if(configs.ROAMSH_CLEAR) {
            await this.block.update("");
        }
        let res;
        try {
            res = await this.interpret(command)
            if (res && typeof(res) !== "function") {
                let out;
                if(typeof(res) === 'object') {
                    out = JSON.stringify(res, null, "\t")
                    out = '`'.repeat(3) + 'javascript\n' + out + '`'.repeat(3)
                } else {
                    out = res
                }
                await this.block.addChild(out.toString())
            }
        } catch (error) {
            this.reportError(error)
            
        }
    },
    reportError(error) {
        errorCodeBlock = "`".repeat(3) + "plain text\n" + error.toString() + "`".repeat(3)
        this.block.addChild(errorCodeBlock)
        throw error
    },
    getCommand: function() {
        let textarea = this.block.getTextAreaElement()
        return textarea.value
    },
    updateToPrevious: function() {
        if (this.commandHistoryId <= -this.commandHistory.length) {
            this.commandHistoryId = -this.commandHistory.length
            return
        }
        this.commandHistoryId = this.commandHistoryId - 1
        let previous = this.commandHistory.slice(this.commandHistoryId)[0]
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
        let prefix = this.createPrefixElement(configs.ROAMSH_PREFIX)
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", prefix)
        this.update()
    },
    removeHTML: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamTerm")
        let prefix = termElement.querySelector(".prompt-prefix-area")
        if (prefix) prefix.remove()
    },
    createPrefixElement: function(string) {
        prefixElement = document.createElement("div")
        prefixElement.classList.add("prompt-prefix-area")
        prefixContent = document.createElement("div")
        prefixContent.classList.add("prompt-prefix-str")
        prefixStr = document.createElement("span")
        prefixStr.innerText = string
        prefixContent.appendChild(prefixStr)
        prefixElement.appendChild(prefixContent)
        return prefixElement
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
        prefix.style.height = input.clientHeight + "px" 
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


Terminal = {
    prompts: {},
    observer: null,
    // Prompt stuff
    getPrompt: function(block) {
        let roamTerm = this.prompts[block.uid]
        if (!roamTerm) {
            roamTerm = new Prompt(block)
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
        let el = document.getElementById(configs.ROAMSH_CSS_ID);
        if (el) {
            return el
        }
        el = document.createElement("style");
        el.textContent = configs.ROAMSH_CSS;
        el.id = configs.ROAMSH_CSS_ID
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
            label: configs.ROAMSH_TERM_LABEL, 
            callback: this.commandPaletteCallback    
        })
    },
    removeCommandFromPallete: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: configs.ROAMSH_TERM_LABEL})
    },
    addHotkeyListener: function() {
        this.hotkeyCallback = this.hotkeyCallback.bind(this)
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.addEventListener("keydown", this.hotkeyCallback) 
    },
    removeHotkeyListener: function() {
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.removeEventListener("keydown", this.hotkeyCallback)
    },
    // Helpers
    count: function() {
        return Object.keys(this.prompts).length
    },
}

module.exports = { Terminal }