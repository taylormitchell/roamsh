// Defaults
configs = {
    ROAMSH_TERM_LABEL: "Roam Shell: Toggle Prompt",
    ROAMSH_TERM_ATTR: "roamshTermListener",
    ROAMSH_CSS_ID: "roam-term",
    ROAMSH_CSS: `
    .roamTerm .rm-block-text
    {
        background-color: rgb(235, 232, 232);
        border-radius: 0 5px 5px 0;
    }

    .roamTerm .prompt-prefix-area {
        background-color: rgb(235, 232, 232);
        display: flex;
        margin-top: -1px;
        flex: 0 0 auto;
        padding-top: 4px;
        padding-left: 4px;
        padding-right: 4px;
        border-radius: 5px 0 0 5px;

    }
    `,
    ROAMSH_INTERPRETER: "js",
    ROAMSH_CLEAR: true,
    ROAMSH_PATHS: ['roamsh/commands']
}
configs.ROAMSH_PREFIX = `(${configs.ROAMSH_INTERPRETER}) ~ %` 

// Replace defaults with any user defined values
if (typeof(window) !== "undefined") {
    for(let [key, value] of Object.entries(configs)) {
        configs[key] = window[key] || value
    }
}

module.exports = configs