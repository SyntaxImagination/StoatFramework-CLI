const { readState }                        = require("../lib/state");
const { isAlive, readMemory, formatUptime } = require("../lib/procutils");

module.exports = function status(args) {
    const cwd   = process.cwd();
    const state = readState(cwd);

    if (!state || !state.pid) {
        console.log("\n  No running instance found.\n");
        return;
    }

    const { pid, startedAt, runtime, entry, denoFlags, logFile, errorFile } = state;
    const alive = isAlive(pid);

    if (!alive) {
        console.log(`\n  Status    stopped (stale state — last PID ${pid})`);
        console.log(`  Run "stoat start" to restart the application.\n`);
        return;
    }

    const memory = readMemory(pid);
    const uptime = formatUptime(startedAt);
    const flags  = (runtime === "deno" && denoFlags?.length) ? denoFlags.join(" ") : null;

    console.log(`
  ┌────────────────────────────────────────┐
  │         Stoat Process Status           │
  └────────────────────────────────────────┘
  Status    running
  PID       ${pid}
  Runtime   ${runtime}
  Entry     ${entry}
  Uptime    ${uptime}
  Memory    ${memory}
  Logs      ${logFile    || "Console/stoat.log"}
  Errors    ${errorFile  || "Console/stoat.error.log"}${flags ? `\n  Flags     ${flags}` : ""}
`);
};
