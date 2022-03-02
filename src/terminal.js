let { RoamResearchShell } = require('./rrsh');
let { Block, Page, Roam } = require('./graph');
const configs = require('./configs');


async function defaultPromptCallback(prompt, command, result, func, ...args) {
    // Clear prompt
    await prompt.block.update("");

    // Add result below it
    
    if (result) {
        let out;
        if(typeof(result) === 'object') {
            let replacer = (key, value) => {
                if(typeof(value) === 'function') {
                    return value.toString().split("\n").slice(0,1) + "}"
                }
                return value
            }
            out = JSON.stringify(result, replacer, "\t")
            out = '`'.repeat(3) + 'javascript\n' + out + '`'.repeat(3)
        } else if(typeof(result) === 'function') {
            out = '`'.repeat(3) + 'javascript\n' + out.toString() + '`'.repeat(3)
        } else {
            out = result.toString()
        }
        await prompt.block.addChild(out.toString())
    }
}

function Prompt(block, callbacks=[]) {
    this.block = block
    this.uid = this.block.uid
    this.current = ""
    this.commandHistory = []
    this.commandHistoryId = 0
    this.observer = null;
    this.interpreter = new RoamResearchShell()
    this.callbacks = callbacks;
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
        // Get command from block and save
        let commandString = this.getCommand()
        this.commandHistory.push(commandString)
        this.commandHistoryId = 0
        let [func, ...args]  = this.interpreter.transpile(commandString)
        // Execute command
        let res;
        try {
            res = await func(...args)
            for(let callback of this.callbacks) {
               await callback(this, commandString, res, func, args)
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
        termElement.querySelector(".rm-block-main").classList.add("roamsh-prompt")
        let prefix = this.createPrefixElement(configs.ROAMSH_PREFIX)
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", prefix)
        this.update()
    },
    removeHTML: function() {
        termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.remove("roamsh-prompt")
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
        return termElement.querySelector(".rm-block-main").classList.contains("roamsh-prompt")
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
    callbacks: [defaultPromptCallback],
    // Prompt stuff
    createPrompt: function(block = null) {
        block = block || Block.getFocused()
        let prompt = new Prompt(block, this.callbacks)
        this.prompts[block.uid] = prompt
        this.updatePrompt(prompt)
        return prompt
    },
    getPrompt: function(block = null) {
        if(!block) {
            block = Block.getFocused()
        }
        return this.prompts[block.uid]
    },
    togglePrompt: function(block = null) {
        block = block || Block.getFocused()
        let prompt = this.getPrompt(block)
        if(prompt) {
            this.removePrompt(prompt)
        } else {
            this.createPrompt(block)
        }
    },
    removePrompt: function(prompt) {
        prompt.deactivate()
        delete this.prompts[prompt.block.uid]
    },
    activatePrompt: function(prompt) {
        prompt.activate()
    },
    executePrompt: function(prompt) {
        prompt.execute()
    },
    updatePrompt: function(prompt) {
        if (!prompt.blockExists()) {
            this.removePrompt(prompt)
        } else if (!prompt.isActive() && prompt.blockInView()) {
            this.activatePrompt(prompt)
        }
        this.updateObservers()
    },
    // Maintain UI and state
    update: function() {
        // Update prompts
        for(let [uid, prompt] of Object.entries(this.prompts)) {
            this.updatePrompt(prompt)
        }
    },
    updateObservers: function() {
        if(this.count() === 1) {
            this.connectObserver()
        } else if(this.count() === 0) {
            this.disconnectObserver()
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
            this.removePrompt(prompt)
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
        this.togglePrompt()
    },
    hotkeyCallback: function(e) {
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let block = Block.getFocused()
            let prompt = this.getPrompt(block)
            if(!prompt) {
                this.createPrompt(block)
            } else if(prompt.isEmpty()) {
                this.removePrompt(prompt)
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

module.exports = { Terminal, Prompt }