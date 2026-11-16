const path = require("path");
const fs   = require("fs");

const STATE_FILE = path.join("bin", ".stoat-state.json");

function statePath(cwd) {
    return path.join(cwd, STATE_FILE);
}

function readState(cwd) {
    try {
        return JSON.parse(fs.readFileSync(statePath(cwd), "utf-8"));
    } catch (_) {
        return null;
    }
}

function writeState(cwd, data) {
    const file = statePath(cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function clearState(cwd) {
    try { fs.unlinkSync(statePath(cwd)); } catch (_) {}
}

module.exports = { readState, writeState, clearState };
