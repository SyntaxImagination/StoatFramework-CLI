const start             = require("./start");
const stop              = require("./stop");
const { readState, clearState } = require("../lib/state");
const { isAlive }       = require("../lib/procutils");

module.exports = function restart(args) {
    const cwd   = process.cwd();
    const state = readState(cwd);

    // Decide which Deno flags to carry into the new process:
    // CLI-supplied flags take precedence; otherwise reuse the flags from the state file.
    const hasNewFlags   = args.some(a => a.startsWith("--allow-") || a.startsWith("--deny-"));
    const inheritedFlags = (!hasNewFlags && state?.denoFlags?.length) ? state.denoFlags : [];
    const startArgs     = hasNewFlags ? args : [...args.filter(a => a !== "--watch"), ...inheritedFlags];

    if (!state || !state.pid || !isAlive(state.pid)) {
        // Nothing is running — just start fresh
        if (state) clearState(cwd);
        console.log("  No running instance — starting fresh …");
        start(startArgs);
        return;
    }

    // Stop the current process, then start once it's gone
    stop([], () => start(startArgs));
};
