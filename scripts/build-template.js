#!/usr/bin/env node
/**
 * Runs on `npm pack` / `npm publish` (prepack) inside CLI/.
 *
 * Copies the framework files that `stoat init` and `stoat update` hand out
 * into CLI/template/, so the published CLI carries them. The framework
 * repository stays the only place those files are edited; template/ is
 * gitignored and rebuilt on every pack.
 *
 * Refuses to build when CLI/package.json and the framework package.json
 * disagree on the version: the CLI version is the framework version.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const CLI_ROOT  = path.join(__dirname, "..");
const REPO_ROOT = path.join(CLI_ROOT, "..");
const OUT       = path.join(CLI_ROOT, "template");

// What projects receive. Models/Schemas and other user folders are never shipped.
const COPY = [
    "System",
    "Helpers",
    path.join("Models", "index.js"),
    path.join("Models", "Engines"),
];

const framework = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
const cli       = JSON.parse(fs.readFileSync(path.join(CLI_ROOT, "package.json"), "utf-8"));

if (framework.version !== cli.version) {
    console.error(
        `\n  build-template: version mismatch\n` +
        `    framework package.json: ${framework.version}\n` +
        `    CLI/package.json:       ${cli.version}\n` +
        `  Set both to the same version, then pack again.\n`
    );
    process.exit(1);
}

const stoatcore = framework.dependencies?.stoatcore;
if (!stoatcore) {
    console.error("\n  build-template: the framework package.json has no stoatcore dependency\n");
    process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const rel of COPY) {
    const src = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(src)) {
        console.error(`\n  build-template: missing ${rel}\n`);
        process.exit(1);
    }
    fs.cpSync(src, path.join(OUT, rel), { recursive: true });
}

fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ version: framework.version, stoatcore }, null, 4) + "\n"
);

// npm includes LICENSE from the package folder automatically
fs.copyFileSync(path.join(REPO_ROOT, "LICENSE"), path.join(CLI_ROOT, "LICENSE"));

console.log(`  build-template: framework ${framework.version}, stoatcore ${stoatcore} → CLI/template/`);
