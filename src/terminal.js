let { RoamResearchShell } = require('./rrsh');
let { Block, Page, Roam } = require('./graph');
const configs = require('./configs');

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
        let command = this.getString()
        this.commandHistory.push(command)
        this.commandHistoryId = 0
        // Transpile and execute
        let [func, ...args]  = this.interpreter.transpile(command)
        let result = await func(...args)
        return [command, result, func, args]
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
            this.connectObserverToBlock()
            this.updateUIonBlock()
        }
    },
    removeUIFromBlock: function() {
        if(!this.blockIsActive()) return
        this.removeHTMLFromBlock()
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

function CodeBlock(element) {
    this.element = element
}
CodeBlock.getFocused = function() {
    let el = document.activeElement.closest(".cm-content")
    if(!el) return null
    return new CodeBlock(el)
}
CodeBlock.prototype.execute = function() {
    let code = this.getCode()
    let res = eval(code)
    if(res){
        res = formatResult(res)
        let block = Block.getFocused()
        block.addChild(res)
    }
} 
CodeBlock.prototype.getCode = function() {
    return this.element.innerText
}
CodeBlock.prototype.getBlock = function() {
    let el = this.element
    while(el && !(el.classList.contains("roam-block"))) {
        el = el.parentElement 
    }
    let id = el.id || ""
    let match = id.match(/block-input-.*\d\d-\d\d-\d\d\d\d-(.*)/) || []
    if(match[1]) {
        return new Block(match[1])
    }    
    return null
}
CodeBlock.prototype.reportError = function(error) {
    let block = this.getBlock()
    if(block) {
        errorCodeBlock = "`".repeat(3) + "plain text\n" + error.toString() + "`".repeat(3)
        block.addChild(errorCodeBlock)
    }
    throw error
}



Terminal = {
    prompts: {},
    observer: null,
    callbacks: [],
    // User affordances
    executePrompt: async function(prompt) {
        if(!prompt) prompt = Prompt.getFocused()
        try {
            let [command, result, func, args] = await prompt.execute()
            for(let callback of this.callbacks) {
                await callback(prompt, command, result, func, args)
            }
        } catch (error) {
            prompt.reportError(error)
        }
    },
    executeCodeBlock: async function(codeBlock) {
        if(!codeBlock) codeBlock = CodeBlock.getFocused()
        try {
            return await codeBlock.execute()
        } catch (error) {
            codeBlock.reportError(error)
        }
    },
    hotkeyHandler: function(e) {
        if (e.ctrlKey && e.metaKey && e.key == "Enter") {
            let codeBlock = CodeBlock.getFocused()
            if(codeBlock) {
                this.executeCodeBlock()
                return
            }
            let block = Block.getFocused()
            if(block) {
                let prompt = this.getPrompt(block)
                if(!prompt) {
                    this.createPrompt(block)
                } else if(prompt.isEmpty()) {
                    this.deletePrompt(prompt)
                } else {
                    this.executePrompt(prompt)
                }
            }
        } else if (e.ctrlKey && e.metaKey && e.key==="ArrowUp") {
            let prompt = this.getPrompt()
            if(!prompt) return
            prompt.goToPrev()
        } else if (e.ctrlKey && e.metaKey && e.key==="ArrowDown") {
            let prompt = this.getPrompt()
            if(!prompt) return
            prompt.goToNext()
        }
    },
    commandPalleteHandler: function() {
        let block = Block.getFocused()
        let prompt = this.getPrompt(block)
        if(!prompt) {
            this.createPrompt(block)
        } else {
            this.deletePrompt(prompt)
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
        this.commandPalleteHandler = this.commandPalleteHandler.bind(this)
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: configs.ROAMSH_TERM_LABEL, 
            callback: this.commandPalleteHandler    
        })
    },
    removeCommandFromPallete: function() {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: configs.ROAMSH_TERM_LABEL})
    },
    addHotkeyListener: function() {
        this.hotkeyHandler = this.hotkeyHandler.bind(this)
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.addEventListener("keydown", this.hotkeyHandler) 
    },
    removeHotkeyListener: function() {
        const roamTerminal = document.querySelector(".roam-app") 
        roamTerminal.removeEventListener("keydown", this.hotkeyHandler)
    },
    // Helpers
    count: function() {
        return Object.keys(this.prompts).length
    },
}

function formatResult(result) {
    formatFunction = (f) => f.toString().split("\n").slice(0,1) + "}"
    if(!result) return
    // Put objects and functions inside code blocks
    if(typeof(result) === 'object') {
        let replacer = (k, v) => typeof(v) === 'function' ? formatFunction(v) : v
        let json = JSON.stringify(result, replacer, "\t")
        return '`'.repeat(3) + 'javascript\n' + json + '`'.repeat(3)
    }
    if(typeof(result) === 'function') {
        return '`'.repeat(3) + 'javascript\n' + formatFunction(f) + '`'.repeat(3)
    }
    // and everything else as a string 
    return result.toString()
}

async function defaultPromptCallback(prompt, command, result, func, args) {
    // Clear prompt
    await prompt.block.update("");
    // Add result below prompt
    if(!result) return
    result = formatResult(result)
    await prompt.block.addChild(result)
}

module.exports = { Terminal, Prompt, formatResult }