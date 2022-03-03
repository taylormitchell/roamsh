let { RoamResearchShell } = require('./rrsh');
let { Block, Page, Roam } = require('./graph');
const configs = require('./configs');


async function defaultPromptCallback(prompt, command, result, func, args) {
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
Prompt.create = function(block, callbacks) {
    let prompt = new Prompt(block, callbacks)
    prompt.addUItoBlock()
    return prompt
},
Prompt.prototype = {
    ...Prompt.prototype,
    // Main prompt actions & properties
    execute: async function () {
        // Get command from block and save
        let commandString = this.getString()
        this.commandHistory.push(commandString)
        this.commandHistoryId = 0
        // Transpile and execute
        try {
            let [func, ...args]  = this.interpreter.transpile(commandString)
            let res = await func(...args)
            for(let callback of this.callbacks) {
               await callback(this, commandString, res, func, args)
            }
        } catch (error) {
            this.reportError(error)
        }
    },
    goToPrev: function() {
        if (this.commandHistoryId <= -this.commandHistory.length) {
            this.commandHistoryId = -this.commandHistory.length
            return
        }
        this.commandHistoryId = this.commandHistoryId - 1
        let previous = this.commandHistory.slice(this.commandHistoryId)[0]
        this.block.update(previous)
    },
    goToNext: function() {
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
    getString: function () {
        if (this.blockIsFocused()) {
            return this.block.getTextAreaElement().value
        } else if(this.blockInView()) {
            return this.block.getElement().innerText
        } else {
            return this.block.getString()
        }
    },
    isEmpty: function() {
        return this.getString() === ""
    },
    addUItoBlock: function() {
        if(!this.blockInView()) {
            return
        } 
        if(!this.blockHasPromptUI()) {
            this.addHTMLToBlock()
            this.addListenersToBlock()
            this.connectObserverToBlock()
            this.updateUIonBlock()
        }
    },
    removeUIFromBlock: function() {
        if(!this.blockIsActive()) return
        this.removeHTMLFromBlock()
        this.removeListenersFromBlock()
        this.disconnectObserverFromBlock()
    },
    updateUIonBlock: function() {
        this.current = this.getString()
        let prefix = this.getPrefixElement()
        let input = this.getInputElement() 
        prefix.style.height = input.clientHeight + "px" 
    },
    // Block properties
    blockExists: function() {
        return this.block.exists()
    },
    blockInView: function() {
        return this.block.getElement() !== null
    },
    blockIsFocused: function() {
        return this.block.isFocused()
    },
    blockHasPromptUI: function() {
        termElement = this.block.getElement()
        return termElement.querySelector(".rm-block-main").classList.contains("roamsh-prompt")
    },
    blockIsActive: function() {
        return this.blockInView() && this.blockHasPromptUI()
    },
    // Block UI
    addHTMLToBlock: function() {
        let termElement = this.block.getElement()
        termElement.querySelector(".rm-block-main").classList.add("roamsh-prompt")
        let prefix = this.createPrefixElement(configs.ROAMSH_PREFIX)
        termElement
            .querySelector(".controls")
            .insertAdjacentElement("afterEnd", prefix)
    },
    removeHTMLFromBlock: function() {
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
    getPrefixElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".prompt-prefix-area") : null
    },
    getInputElement: function() {
        let el = this.block.getElement()
        return el ? el.querySelector(".rm-block__input") : null
    },
    // Listeners
    executeListener: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="Enter") {
            if (!this.isEmpty()) {
                this.execute()
            }
        }
    },
    goToPrevListener: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="ArrowUp") {
            this.goToPrev()
        }
    },
    goToNextListener: function(e) {
        if (e.ctrlKey && e.metaKey && e.key==="ArrowDown") {
            this.goToNext()
        }
    },
    addListenersToBlock: function() {
        let el = this.block.getElement()
        this.executeListener = this.executeListener.bind(this)
        this.goToPrevListener = this.goToPrevListener.bind(this)
        this.goToNextListener = this.goToNextListener.bind(this)        
        el.addEventListener("keydown", this.executeListener)
        el.addEventListener("keydown", this.goToPrevListener)
        el.addEventListener("keydown", this.goToNextListener)
    },
    removeListenersFromBlock: function() {
        let el = this.block.getElement()
        el.removeEventListener("keydown", this.executeListener)
        el.removeEventListener("keydown", this.goToPrevListener)
        el.removeEventListener("keydown", this.goToNextListener)
    },
    connectObserverToBlock: function() {
        const targetNode = this.block.getElement();
        const config = { childList: true, subtree: true };
        this.updateUIonBlock = this.updateUIonBlock.bind(this)
        this.observer = new MutationObserver(this.updateUIonBlock);
        this.observer.observe(targetNode, config);
    },
    disconnectObserverFromBlock: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    // Helpers
    reportError(error) {
        errorCodeBlock = "`".repeat(3) + "plain text\n" + error.toString() + "`".repeat(3)
        this.block.addChild(errorCodeBlock)
        throw error
    }
}


Terminal = {
    prompts: {},
    observer: null,
    callbacks: [],
    // User affordances
    commandPalleteTogglePrompt: function() {
        let block = Block.getFocused()
        let prompt = this.getPrompt(block)
        if(!prompt) {
            this.createPrompt(block)
        } else {
            this.deletePrompt(prompt)
        }
    },
    hotkeyTogglePrompt: function(e) {
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let block = Block.getFocused()
            let prompt = this.getPrompt(block)
            if(!prompt) {
                this.createPrompt(block)
            } else if(prompt.isEmpty()) {
                this.deletePrompt(prompt)
            }
        }
    },
    // Prompt CRUD
    createPrompt: function(block = null) {
        block = block || Block.getFocused()
        let prompt = Prompt.create(block, this.callbacks)
        this.prompts[block.uid] = prompt
        if(this.count() === 1) {
            this.startUpdatePromptsOnViewChange()
        }
        return prompt
    },
    getPrompt: function(block = null) {
        block = block || Block.getFocused()
        return this.prompts[block.uid]
    },
    updatePrompt: function(prompt) {
        if (!prompt.blockExists()) {
            this.deletePrompt(prompt)
        } else if (prompt.blockInView() && !prompt.blockHasPromptUI()) {
            prompt.addUItoBlock()
        }
    },
    deletePrompt: function(prompt) {
        prompt.removeUIFromBlock()
        delete this.prompts[prompt.block.uid]
        if(this.count() === 0) {
            this.stopUpdatePromptsOnViewChange()
        }
    },
    // Maintain prompt UI and state
    updatePrompts: function() {
        // Update prompts
        for(let prompt of Object.values(this.prompts)) {
            this.updatePrompt(prompt)
        }
    },
    startUpdatePromptsOnViewChange: function() {
        const targetNode = document.querySelector('.roam-app');
        const config = { childList: true, subtree: true };
        this.updatePrompts = this.updatePrompts.bind(this)
        this.observer = new MutationObserver(this.updatePrompts);
        this.observer.observe(targetNode, config);
    },
    stopUpdatePromptsOnViewChange: function() {
        if (!this.observer) return;
        this.observer.disconnect();
        this.observer = null;
    },
    // Set up and tear down  
    setUp: function() {
        this.addStyle()
        this.addCommandToPallete()
        this.addHotkeyListener()
        this.resetCallbacks()
    },
    tearDown: function() {
        for (let [uid, prompt] of Object.entries(this.prompts)) {
            this.deletePrompt(prompt)
        }
        this.removeCommandFromPallete()
        this.removeHotkeyListener()
        this.callbacks = []
    },
    resetCallbacks: function() {
        this.callbacks = [defaultPromptCallback]
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
    addCommandToPallete: function() {
        this.commandPalleteTogglePrompt = this.commandPalleteTogglePrompt.bind(this)
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: configs.ROAMSH_TERM_LABEL, 
            callback: this.commandPalleteTogglePrompt    
        })
    },
    removeCommandFromPallete: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: configs.ROAMSH_TERM_LABEL})
    },
    addHotkeyListener: function() {
        this.hotkeyTogglePrompt = this.hotkeyTogglePrompt.bind(this)
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.addEventListener("keydown", this.hotkeyTogglePrompt) 
    },
    removeHotkeyListener: function() {
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.removeEventListener("keydown", this.hotkeyTogglePrompt)
    },
    // Helpers
    count: function() {
        return Object.keys(this.prompts).length
    },
}

module.exports = { Terminal, Prompt }