const path              = require("path");
const fs                = require("fs");
const { spawn }         = require("child_process");
const { readState, writeState } = require("../lib/state");
const { readConfig, buildCommand, isAlive } = require("../lib/procutils");

module.exports = function start(args) {
    const cwd     = process.cwd();
    const isWatch = args.includes("--watch");

    // Collect Deno permission flags passed on the command line
    const cliDenoFlags = args.filter(a =>
        a.startsWith("--allow-") ||
        a.startsWith("--deny-")  ||
        a === "--unstable"        ||
        a === "--no-prompt"
    );

    if (isWatch) {
        runWatch(cwd, cliDenoFlags);
        return;
    }

    // Guard: refuse if a live process already exists
    const existing = readState(cwd);
    if (existing && existing.pid && isAlive(existing.pid)) {
        console.log(`\n  Already running  [PID ${existing.pid}]  runtime: ${existing.runtime}`);
        console.log(`  Use "stoat restart" to restart, or "stoat stop" to stop.\n`);
        process.exit(1);
    }

    const { runtime, entry, denoFlags: cfgFlags } = readConfig(cwd);

    // CLI flags take precedence; fall back to bin/.config shell.denoFlags; then default to --allow-all for Deno
    let finalDenoFlags = cliDenoFlags.length > 0 ? cliDenoFlags : cfgFlags;
    if (runtime === "deno" && finalDenoFlags.length === 0) {
        finalDenoFlags = ["--allow-all"];
    }

    const { cmd, args: cmdArgs } = buildCommand(runtime, entry, finalDenoFlags, false);

    // Ensure Console/ directory exists
    const consoleDir = path.join(cwd, "Console");
    fs.mkdirSync(consoleDir, { recursive: true });

    const logFile   = path.join(consoleDir, "stoat.log");
    const errorFile = path.join(consoleDir, "stoat.error.log");

    const logFd   = fs.openSync(logFile,   "a");
    const errorFd = fs.openSync(errorFile, "a");

    const child = spawn(cmd, cmdArgs, {
        cwd,
        detached: true,
        stdio: ["ignore", logFd, errorFd],
    });

    child.unref();
    fs.closeSync(logFd);
    fs.closeSync(errorFd);

    writeState(cwd, {
        pid:       child.pid,
        status:    "running",
        startedAt: new Date().toISOString(),
        runtime,
        entry,
        denoFlags: finalDenoFlags,
        logFile:   "Console/stoat.log",
        errorFile: "Console/stoat.error.log",
    });

    console.log(`\n  Started   ${runtime}  ${entry}  [PID ${child.pid}]`);
    if (runtime === "deno" && finalDenoFlags.length) {
        console.log(`  Flags     ${finalDenoFlags.join(" ")}`);
    }
    console.log(`  Logs  →   Console/stoat.log\n`);
};

// Recursively snapshot all files under `dir` as paths relative to `dir`.
// Used to detect added/removed controller files that the runtime's own
// --watch misses (it only tracks files already require()'d at startup).
function snapshotFiles(dir) {
    const out   = new Set();
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        let entries;
        try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (_) { continue; }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else out.add(path.relative(dir, full));
        }
    }
    return out;
}

function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
}

function runWatch(cwd, cliDenoFlags) {
    const { runtime, entry, denoFlags: cfgFlags, controllerDir: controllerDirName } = readConfig(cwd);

    let finalDenoFlags = cliDenoFlags.length > 0 ? cliDenoFlags : cfgFlags;
    if (runtime === "deno" && finalDenoFlags.length === 0) {
        finalDenoFlags = ["--allow-all"];
    }

    const { cmd, args: cmdArgs } = buildCommand(runtime, entry, finalDenoFlags, true);

    console.log(`\n  Watch mode  ${runtime}  ${entry}`);
    if (runtime === "deno" && finalDenoFlags.length) {
        console.log(`  Flags       ${finalDenoFlags.join(" ")}`);
    }
    console.log(`  Press Ctrl+C to stop\n`);

    let child;
    let manualRestart = false;

    const spawnChild = () => {
        child = spawn(cmd, cmdArgs, { cwd, stdio: "inherit" });
        child.on("exit", (code) => {
            if (manualRestart) {
                manualRestart = false;
                spawnChild();
                return;
            }
            cleanupWatcher();
            console.log(`\n  Process exited (${code ?? 0})`);
            process.exit(code ?? 0);
        });
    };

    // Watch the controller directory for added/removed files.
    // The runtime's --watch only restarts when already-loaded files change;
    // a brand-new controller is invisible to it until the next full restart.
    const controllerDir = path.join(cwd, controllerDirName);
    let dirWatcher    = null;
    let knownFiles    = null;
    let debounceTimer = null;

    if (fs.existsSync(controllerDir)) {
        knownFiles = snapshotFiles(controllerDir);
        try {
            dirWatcher = fs.watch(controllerDir, { recursive: true }, (eventType, filename) => {
                if (eventType !== "rename") return; // edits handled by runtime --watch
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const current = snapshotFiles(controllerDir);
                    if (setsEqual(current, knownFiles)) return;
                    knownFiles = current;
                    console.log(`\n  [watch] ${controllerDirName}/${filename} added or removed — restarting ${runtime}…\n`);
                    manualRestart = true;
                    try { child.kill("SIGTERM"); } catch (_) {}
                }, 300);
            });
        } catch (err) {
            console.log(`  [watch] controller directory watch unavailable: ${err.message}`);
        }
    }

    const cleanupWatcher = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (dirWatcher)    dirWatcher.close();
    };

    const cleanup = () => {
        manualRestart = false;
        cleanupWatcher();
        try { child.kill("SIGTERM"); } catch (_) {}
        process.exit(0);
    };

    process.on("SIGINT",  cleanup);
    process.on("SIGTERM", cleanup);

    spawnChild();
}
