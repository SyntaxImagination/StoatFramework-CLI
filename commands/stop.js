const { readState, clearState } = require("../lib/state");
const { isAlive }               = require("../lib/procutils");

const SIGTERM_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS   = 200;

module.exports = function stop(args, onDone) {
    const cwd   = process.cwd();
    const state = readState(cwd);

    if (!state || !state.pid) {
        console.log("\n  No running instance found.\n");
        if (onDone) onDone();
        return;
    }

    const { pid } = state;

    if (!isAlive(pid)) {
        console.log(`\n  Process ${pid} is not running (stale state — cleaning up).\n`);
        clearState(cwd);
        if (onDone) onDone();
        return;
    }

    console.log(`\n  Stopping [PID ${pid}] …`);

    try {
        process.kill(pid, "SIGTERM");
    } catch (e) {
        if (e.code === "EPERM") {
            console.error(`  Cannot stop: process ${pid} belongs to another user.\n`);
            process.exit(1);
        }
        // ESRCH — already gone
        clearState(cwd);
        console.log("  Stopped.\n");
        if (onDone) onDone();
        return;
    }

    const deadline = Date.now() + SIGTERM_TIMEOUT_MS;

    const poll = setInterval(() => {
        if (!isAlive(pid)) {
            clearInterval(poll);
            clearState(cwd);
            console.log("  Stopped.\n");
            if (onDone) onDone();
            return;
        }

        if (Date.now() >= deadline) {
            clearInterval(poll);
            try { process.kill(pid, "SIGKILL"); } catch (_) {}
            clearState(cwd);
            console.log("  Force killed (SIGKILL).\n");
            if (onDone) onDone();
        }
    }, POLL_INTERVAL_MS);
};
