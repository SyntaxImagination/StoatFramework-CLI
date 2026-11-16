/**
 * Where the CLI finds the framework files it copies into projects.
 *
 * Published package (stoatframework-cli): `CLI/template/`, built by
 * scripts/build-template.js when the package is packed. It holds System/,
 * Models/, Helpers/ and manifest.json (framework version + stoatcore range).
 *
 * Framework repository (development): the CLI always reads System/, Models/
 * and Helpers/ straight from the repository root (even if a build left a
 * template/ folder behind) and takes the versions from the root package.json.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const CLI_ROOT      = path.join(__dirname, "..");
const BUNDLED       = path.join(CLI_ROOT, "template");
const REPO_ROOT     = path.join(CLI_ROOT, "..");
// Inside the framework repository the live files win over a leftover build
function isFrameworkRepo() {
    try {
        return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")).name === "stoatframework"
            && fs.existsSync(path.join(REPO_ROOT, "System", "Core", "http.js"));
    } catch (_) {
        return false;
    }
}

const IS_BUNDLED    = !isFrameworkRepo() && fs.existsSync(path.join(BUNDLED, "manifest.json"));
const TEMPLATE_ROOT = IS_BUNDLED ? BUNDLED : REPO_ROOT;

function readManifest() {
    if (IS_BUNDLED) return JSON.parse(fs.readFileSync(path.join(BUNDLED, "manifest.json"), "utf-8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    return { version: pkg.version, stoatcore: pkg.dependencies.stoatcore };
}

// A published CLI without template/ would scaffold empty projects; stop instead.
if (!IS_BUNDLED && !isFrameworkRepo()) {
    console.error(
        "\n  Stoat CLI: framework templates are missing (expected " + path.join(BUNDLED, "manifest.json") + ").\n" +
        "  This copy of stoatframework-cli was packed without running scripts/build-template.js.\n" +
        "  Reinstall it:  npm install -g stoatframework-cli@latest\n"
    );
    process.exit(1);
}

const manifest = readManifest();

module.exports = {
    CLI_ROOT,
    TEMPLATE_ROOT,
    IS_BUNDLED,
    FRAMEWORK_VERSION: manifest.version,
    STOATCORE_RANGE:   manifest.stoatcore,
};
