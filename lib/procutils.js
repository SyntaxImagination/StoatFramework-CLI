const fs            = require("fs");
const path          = require("path");
const { spawnSync } = require("child_process");

function readConfig(cwd) {
    try {
        const raw  = fs.readFileSync(path.join(cwd, "bin", ".config"), "utf-8");
        const cfg  = JSON.parse(raw);
        const rt   = (cfg.shell?.runtime || detectRuntime(cwd)).toLowerCase();
        const ent  = cfg.shell?.entry   || detectEntry(cwd, rt);
        const dfl  = Array.isArray(cfg.shell?.denoFlags) ? cfg.shell.denoFlags : [];
        const ctl  = cfg.folders?.controller || "Engine";
        return { runtime: rt, entry: ent, denoFlags: dfl, controllerDir: ctl };
    } catch (_) {
        const rt  = detectRuntime(cwd);
        return { runtime: rt, entry: detectEntry(cwd, rt), denoFlags: [], controllerDir: "Engine" };
    }
}

function detectRuntime(cwd) {
    if (fs.existsSync(path.join(cwd, "deno.json")))        return "deno";
    if (fs.existsSync(path.join(cwd, "package-lock.json"))) return "node";
    return "bun";
}

function detectEntry(cwd, runtime) {
    if (runtime === "deno") return "base.ts";
    if (fs.existsSync(path.join(cwd, "base.ts")))  return "base.ts";
    if (fs.existsSync(path.join(cwd, "base.mjs"))) return "base.mjs";
    return "base.js";
}

function buildCommand(runtime, entry, denoFlags, watch) {
    if (runtime === "deno") {
        const flags = denoFlags.length > 0 ? [...denoFlags] : ["--allow-all"];
        if (watch) flags.push("--watch");
        return { cmd: "deno", args: ["run", ...flags, entry] };
    }
    if (runtime === "bun") {
        const watchFlag = watch ? ["--watch"] : [];
        return { cmd: "bun", args: [...watchFlag, "run", entry] };
    }
    // node
    const watchFlag = watch ? ["--watch"] : [];
    return { cmd: "node", args: [...watchFlag, entry] };
}

function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

function readMemory(pid) {
    // Linux — read VmRSS from /proc/<pid>/status
    try {
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf-8");
        const match  = status.match(/VmRSS:\s+(\d+)\s+kB/);
        if (match) return `${(parseInt(match[1], 10) / 1024).toFixed(1)} MB`;
    } catch (_) {}

    // Fallback — ps (Linux + macOS)
    try {
        const r = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf-8" });
        if (r.status === 0) {
            const kb = parseInt(r.stdout.trim(), 10);
            if (!isNaN(kb)) return `${(kb / 1024).toFixed(1)} MB`;
        }
    } catch (_) {}

    return "N/A";
}

function formatUptime(startedAt) {
    const ms  = Date.now() - new Date(startedAt).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr  = Math.floor(min / 60);
    const day = Math.floor(hr  / 24);

    if (day > 0) return `${day}d ${hr % 24}h ${min % 60}m`;
    if (hr  > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
}

module.exports = { readConfig, buildCommand, isAlive, readMemory, formatUptime };
