#!/usr/bin/env node

const args    = process.argv.slice(2);
const command = args[0];
const rest    = args.slice(1);

const { FRAMEWORK_VERSION } = require("../lib/paths");

const HELP = `
  Stoat CLI — v${FRAMEWORK_VERSION}

  Usage:
    stoat <command> [options]

  Commands:
    init                         Scaffold a new Stoat project
    --version, -v                Print the CLI / framework version
    generate <type> <name>       Generate a controller or model
      Types: controller (c), model (m)

    start [--watch] [flags]      Start the app in the background (or foreground with --watch)
    stop                         Stop the running app
    restart [flags]              Stop then start the app
    status                       Show PID, runtime, uptime, and memory
    logs [--error] [--follow]    View or tail application logs
      --lines <n>                Number of lines to show (default: 50)
      --clear                    Wipe both log files

    update [--check] [--force]   Update framework files (System, Models/Engines)
      --check                    Preview what would be updated without writing files
      --force                    Also overwrite existing files in Helpers/

  Deno flags (passed to "deno run"):
    --allow-net --allow-read --allow-env --allow-write --allow-run --allow-all …

  Examples:
    stoat init
    stoat generate controller users
    stoat g c products
    stoat g m users

    stoat start
    stoat start --allow-net --allow-read --allow-env
    stoat start --watch
    stoat stop
    stoat restart
    stoat restart --allow-all
    stoat status
    stoat logs
    stoat logs --follow
    stoat logs --error
    stoat logs --lines 100
    stoat logs --clear

    stoat update
    stoat update --check

  package.json / deno.json dev scripts:
    "scripts": {
      "start": "node base.mjs",
      "dev":   "stoat start --watch"
    }

  Note: "stoat start --watch" is preferred over running the runtime's --watch directly.
  The runtime's own --watch only restarts when already-loaded files change.
  stoat adds a second watcher on the controller directory (Engine/ by default)
  so that brand-new controller files trigger a restart automatically.

  Entry point: new projects use base.mjs (ESM) for Node/Bun JS projects.
  The createRequire bridge inside base.mjs keeps CJS framework files working.
`;

switch (command) {
    case "init":
        require("../commands/init")(rest);
        break;

    case "generate":
    case "g":
        require("../commands/generate")(rest);
        break;

    case "start":
        require("../commands/start")(rest);
        break;

    case "stop":
        require("../commands/stop")(rest);
        break;

    case "restart":
        require("../commands/restart")(rest);
        break;

    case "status":
        require("../commands/status")(rest);
        break;

    case "logs":
        require("../commands/logs")(rest);
        break;

    case "update":
        require("../commands/update")(rest);
        break;

    case "--version":
    case "-v":
        console.log(FRAMEWORK_VERSION);
        break;

    case "--help":
    case "-h":
    case undefined:
        console.log(HELP);
        break;

    default:
        console.error(`  Unknown command: ${command}\n  Run "stoat --help" for usage.\n`);
        process.exit(1);
}
