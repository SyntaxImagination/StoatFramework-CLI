# stoatframework-cli

The `stoat` command for the [Stoat Framework](https://github.com/SyntaxImagination/Stoat-Framework): scaffold, generate, run and update Stoat projects on Node.js, Bun and Deno. It has no dependencies.

## Install

```bash
npm install -g stoatframework-cli
stoat init
```

Or run it without installing:

```bash
npx stoatframework-cli init               # npm
bunx stoatframework-cli init              # Bun
deno run -A npm:stoatframework-cli init   # Deno
```

Use the full package name with `npx`. `npx stoat` fetches a different, unrelated package.

Requires Node.js 18 or later to run the CLI. Generated apps run on Node, Bun or Deno.

## Commands

```
stoat init                         Scaffold a new project (runtime, language, port, database)
stoat generate controller <name>   Controller in Engine/v1/      (alias: stoat g c <name>)
stoat generate model <name>        Schema stub in Models/Schemas/ (alias: stoat g m <name>)
stoat start [--watch]              Start in the background, or in the foreground with --watch
stoat stop | restart | status      Manage the running app
stoat logs [--follow] [--error]    Read Console/ logs
stoat update [--check] [--force]   Refresh the framework files in a project
stoat --version                    Framework version this CLI installs
```

## Versions

The CLI version is the framework version. The package contains the framework files (`System/`, `Models/`, `Helpers/`) that `stoat init` copies and `stoat update` refreshes. To upgrade a project:

```bash
npm install -g stoatframework-cli@latest
cd my-app
stoat update --check   # preview
stoat update
```

Projects made with `stoat init` also list the CLI in `devDependencies`, so `npm run dev` and `npx stoat <command>` work inside the project without a global install. The runtime core, [`stoatcore`](https://www.npmjs.com/package/stoatcore), is installed per project.

Full documentation: https://github.com/SyntaxImagination/Stoat-Framework#readme

## Development

This repository is checked out inside the framework repository, the same way as `StoatCore/`:

```bash
git clone https://github.com/SyntaxImagination/Stoat-Framework.git
cd Stoat-Framework
git clone https://github.com/SyntaxImagination/StoatFramework-CLI.git CLI
npm install && npm test        # includes test/cli-package.test.js
```

`scripts/build-template.js` copies the framework files from the parent folder (`../System`, `../Helpers`, `../Models`) into `template/`. It cannot run from a standalone clone. In development the CLI reads those files straight from the parent folder.

Publishing, from the framework root (both `package.json` versions must match):

```bash
npm run cli:pack                            # optional: inspect the tarball
npm run cli:publish
```

## License

MIT
