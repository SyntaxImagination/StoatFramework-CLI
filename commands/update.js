const path      = require("path");
const fs        = require("fs");
const { copyDir, copyFile, writeFile, ensureDir } = require("../lib/scaffold");
const templates = require("../lib/templates");

// Framework files bundled with the CLI (or the repository root in development)
const { TEMPLATE_ROOT: PKG_ROOT, FRAMEWORK_VERSION } = require("../lib/paths");

// Framework-owned directories — safe to overwrite on every update
// (stoatcore is managed via npm / bun / deno, not a local directory)
const FRAMEWORK_DIRS = ["System"];

/**
 * Copy files from src into dest only if they do not already exist at dest.
 * Preserves user-customized files (e.g. Helpers/Security.js).
 */
function copyMissingFiles(src, dest, dryRun) {
    if (!fs.existsSync(src)) return { added: [], preserved: [] };
    if (!dryRun) ensureDir(dest);

    const added     = [];
    const preserved = [];

    fs.readdirSync(src, { withFileTypes: true }).forEach((entry) => {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            const sub = copyMissingFiles(srcPath, destPath, dryRun);
            added.push(...sub.added.map((f) => path.join(entry.name, f)));
            preserved.push(...sub.preserved.map((f) => path.join(entry.name, f)));
        } else if (fs.existsSync(destPath)) {
            preserved.push(entry.name);
        } else {
            if (!dryRun) copyFile(srcPath, destPath);
            added.push(entry.name);
        }
    });

    return { added, preserved };
}

// ── stoatcore dependency migration (OPEN-5) ─────────────────────────────────
// Projects scaffolded before stoatcore moved to npm depend on a bundled copy
// ("file:./StoatCore" / "./StoatCore/core.js"). Others may pin an older range.
// Both are rewritten to the range this framework version requires.

function minVersion(spec) {
    const m = String(spec).match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? m.slice(1, 4).map(Number) : null;
}

function isOlder(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
}

function isLocalCopy(spec) {
    return /^(file:|link:|\.{1,2}\/)/.test(String(spec)) || /StoatCore/.test(String(spec));
}

/** Returns the replacement spec, or null if `current` is fine as it is. */
function upgradeSpec(current, required, prefix = "") {
    if (isLocalCopy(current)) return prefix + required;
    const cur = minVersion(String(current).replace(prefix, ""));
    const req = minVersion(required);
    if (cur && req && isOlder(cur, req)) return prefix + required;
    return null;   // newer, equal, or not a version we understand ("latest", "*")
}

function rewriteJson(filePath, mutate, dryRun) {
    const raw    = fs.readFileSync(filePath, "utf-8");
    const data   = JSON.parse(raw);
    const change = mutate(data);
    if (change && !dryRun) {
        const indent = (raw.match(/^([ \t]+)"/m) || [, "  "])[1];
        fs.writeFileSync(filePath, JSON.stringify(data, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
    }
    return change;
}

function migrateStoatcore(cwd, dryRun) {
    const required = templates.STOATCORE_RANGE;
    const changes  = [];
    const install  = [];

    const pkgPath = path.join(cwd, "package.json");
    if (fs.existsSync(pkgPath)) {
        const change = rewriteJson(pkgPath, (pkg) => {
            for (const field of ["dependencies", "devDependencies"]) {
                const current = pkg[field]?.stoatcore;
                if (current === undefined) continue;
                const next = upgradeSpec(current, required);
                if (next) {
                    pkg[field].stoatcore = next;
                    return `package.json  stoatcore: "${current}" → "${next}"`;
                }
            }
            return null;
        }, dryRun);
        if (change) {
            changes.push(change);
            install.push(fs.existsSync(path.join(cwd, "bun.lockb")) || fs.existsSync(path.join(cwd, "bun.lock"))
                ? "bun install" : "npm install");
        }
    }

    const denoPath = path.join(cwd, "deno.json");
    if (fs.existsSync(denoPath)) {
        const change = rewriteJson(denoPath, (deno) => {
            const current = deno.imports?.stoatcore;
            if (current === undefined) return null;
            const next = upgradeSpec(current, required, "npm:stoatcore@");
            if (!next) return null;
            deno.imports.stoatcore = next;
            return `deno.json     imports.stoatcore: "${current}" → "${next}"`;
        }, dryRun);
        if (change) {
            changes.push(change);
            install.push("deno install");
        }
    }

    const leftover = fs.existsSync(path.join(cwd, "StoatCore")) ? "StoatCore/" : null;
    return { changes, install, leftover };
}

module.exports = function update(args) {
    const cwd    = process.cwd();
    const dryRun = args.includes("--check");
    const force  = args.includes("--force");

    // Verify this is a Stoat project
    const configPath = path.join(cwd, "bin", ".config");
    if (!fs.existsSync(configPath)) {
        console.error(
            "\n  Not a Stoat project — bin/.config not found." +
            "\n  Run 'stoat init' to scaffold a new project.\n"
        );
        process.exit(1);
    }

    // Read installed package version
    const pkgVersion = FRAMEWORK_VERSION || "unknown";

    const label = dryRun ? "Update check" : "Updating";
    console.log(`\n  Stoat Framework ${label}  (installed: v${pkgVersion})\n`);

    const updated   = [];
    const preserved = [];
    const missing   = [];

    // ── Core framework directories (System) ──────────────────────────────────
    for (const dir of FRAMEWORK_DIRS) {
        const src  = path.join(PKG_ROOT, dir);
        const dest = path.join(cwd, dir);

        if (!fs.existsSync(src)) {
            missing.push(dir + "/");
            continue;
        }

        if (!dryRun) copyDir(src, dest);
        updated.push(dir + "/");
    }

    // ── Models (sync index.js & Engines/ only — never touch Models/Schemas/) ─
    const modelsIndexSrc  = path.join(PKG_ROOT, "Models", "index.js");
    const modelsIndexDest = path.join(cwd, "Models", "index.js");
    if (fs.existsSync(modelsIndexSrc)) {
        if (!dryRun) copyFile(modelsIndexSrc, modelsIndexDest);
        updated.push("Models/index.js");
    } else {
        missing.push("Models/index.js");
    }

    const enginesSrc  = path.join(PKG_ROOT, "Models", "Engines");
    const enginesDest = path.join(cwd, "Models", "Engines");
    if (fs.existsSync(enginesSrc)) {
        if (!dryRun) copyDir(enginesSrc, enginesDest);
        updated.push("Models/Engines/");
    } else {
        missing.push("Models/Engines/");
    }
    preserved.push("Models/Schemas/");

    // ── Helpers (preserve existing user helpers unless --force is passed) ────
    const helpersSrc  = path.join(PKG_ROOT, "Helpers");
    const helpersDest = path.join(cwd, "Helpers");
    if (fs.existsSync(helpersSrc)) {
        if (force) {
            if (!dryRun) copyDir(helpersSrc, helpersDest);
            updated.push("Helpers/ (forced)");
        } else {
            const res = copyMissingFiles(helpersSrc, helpersDest, dryRun);
            res.added.forEach((f) => updated.push(`Helpers/${f} (new)`));
            res.preserved.forEach((f) => preserved.push(`Helpers/${f}`));
        }
    } else {
        missing.push("Helpers/");
    }

    // ── runStoatConfig.js ────────────────────────────────────────────────────
    const runConfigPath = path.join(cwd, "runStoatConfig.js");
    if (!dryRun) writeFile(runConfigPath, templates.runStoatConfig());
    updated.push("runStoatConfig.js");

    // ── Report ───────────────────────────────────────────────────────────────
    const action = dryRun ? "Would update" : "Updated";
    console.log(`  ${action}:\n`);
    updated.forEach((f) => console.log(`    [ok]   ${f}`));

    if (preserved.length) {
        const keepLabel = dryRun ? "Would preserve" : "Preserved";
        console.log(`\n  ${keepLabel} (user files — use --force to overwrite Helpers):\n`);
        preserved.forEach((f) => console.log(`    [keep] ${f}`));
    }

    if (missing.length) {
        console.log("\n  Not found in package (skipped):\n");
        missing.forEach((f) => console.log(`    [-]    ${f}`));
    }

    // ── stoatcore dependency (OPEN-5) ────────────────────────────────────────
    const deps = migrateStoatcore(cwd, dryRun);
    if (deps.changes.length || deps.leftover) {
        console.log(`\n  Dependencies (stoatcore ${templates.STOATCORE_RANGE}):\n`);
        const verb = dryRun ? "Would change" : "Changed";
        deps.changes.forEach((c) => console.log(`    [ok]   ${verb}: ${c}`));
        if (deps.leftover) {
            console.log(
                `    [note] ${deps.leftover} is the old bundled copy and is no longer used — ` +
                `delete it once you have checked it has no local edits.`
            );
        }
        if (deps.install.length) {
            console.log(`\n  Then run: ${[...new Set(deps.install)].join("  /  ")}`);
        }
    }

    console.log();

    if (dryRun) {
        console.log("  Run 'stoat update' (without --check) to apply.\n");
    } else {
        console.log("  Your project files were not changed (apart from the stoatcore entry above, if listed):\n");
        console.log("    Engine/   Models/Schemas/   bin/.config   base.*   Public/   OtherFiles/\n");
        console.log("  Tip: run 'npm update stoatcore' (or bun/deno) to update stoatcore, and 'stoat restart' if running.\n");
    }
};
