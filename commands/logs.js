const path      = require("path");
const fs        = require("fs");
const { readState } = require("../lib/state");

const DEFAULT_LINES = 50;

module.exports = function logs(args) {
    const cwd      = process.cwd();
    const isError  = args.includes("--error");
    const isClear  = args.includes("--clear");
    const isFollow = args.includes("--follow") || args.includes("-f");

    // --lines <n>  or  --lines=<n>
    let lines = DEFAULT_LINES;
    const eqFlag   = args.find(a => a.startsWith("--lines="));
    const spaceIdx = args.indexOf("--lines");

    if (eqFlag) {
        lines = parseInt(eqFlag.split("=")[1], 10) || DEFAULT_LINES;
    } else if (spaceIdx !== -1 && args[spaceIdx + 1]) {
        lines = parseInt(args[spaceIdx + 1], 10) || DEFAULT_LINES;
    }

    const state    = readState(cwd);
    const logFile  = isError
        ? path.join(cwd, "Console", "stoat.error.log")
        : path.join(cwd, state?.logFile || "Console/stoat.log");

    // Clear both log files
    if (isClear) {
        const files = [
            path.join(cwd, "Console", "stoat.log"),
            path.join(cwd, "Console", "stoat.error.log"),
        ];
        let cleared = 0;
        for (const f of files) {
            try { fs.writeFileSync(f, ""); cleared++; } catch (_) {}
        }
        console.log(cleared > 0 ? "\n  Log files cleared.\n" : "\n  No log files found to clear.\n");
        return;
    }

    if (!fs.existsSync(logFile)) {
        console.log(`\n  Log file not found: Console/${isError ? "stoat.error.log" : "stoat.log"}`);
        console.log(`  Start the app first with "stoat start".\n`);
        return;
    }

    if (isFollow) {
        console.log(`\n  Tailing ${isError ? "error" : "combined"} log — Ctrl+C to stop\n`);
        printLastLines(logFile, lines);

        let size = fs.statSync(logFile).size;

        fs.watch(logFile, () => {
            try {
                const stat = fs.statSync(logFile);
                if (stat.size > size) {
                    const stream = fs.createReadStream(logFile, { start: size });
                    stream.pipe(process.stdout);
                    size = stat.size;
                } else if (stat.size < size) {
                    // File was truncated (stoat logs --clear)
                    size = stat.size;
                }
            } catch (_) {}
        });

        process.on("SIGINT", () => { process.stdout.write("\n"); process.exit(0); });
        return;
    }

    printLastLines(logFile, lines);
};

function printLastLines(file, count) {
    const content  = fs.readFileSync(file, "utf-8");
    const allLines = content.split("\n");
    // +1 because the last element may be an empty string from a trailing newline
    const output   = allLines.slice(Math.max(0, allLines.length - count - 1)).join("\n");
    process.stdout.write(output.trimEnd() + "\n");
}
