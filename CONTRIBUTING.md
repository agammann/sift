# Development and contributions

[Back to the README](README.md)

Use this guide to build Sift from source. To use the packaged application, start with [Getting started](docs/GETTING_STARTED.md).

## Set up a checkout

Requires Git, Node.js 24.15 or later within Node 24, and **pnpm 11.19.0**. Verify `node --version` first. If pnpm is not installed, install that exact version with `npm install --global pnpm@11.19.0`, then reopen the terminal. On Windows, `npm.cmd` and `pnpm.cmd` can be used if PowerShell blocks script shims.

```sh
git clone https://github.com/agammann/sift.git
cd sift
pnpm --version
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

Expect pnpm `11.19.0`, a completed TypeScript and Vite build, and passing tests. `pnpm-workspace.yaml` allows the required esbuild install step. Preserve `pnpm-lock.yaml`; do not regenerate it merely to get past an installation error.

## Run a development workspace

Use a separate database while developing so experiments do not affect your normal collections:

```sh
node dist/cli.js doctor --db ./dev-data/sift.sqlite
node dist/cli.js start --db ./dev-data/sift.sqlite --port 4588
```

Open `http://127.0.0.1:4588`. Stop with Ctrl+C before rebuilding or running doctor against this database. To connect an MCP client to it, supply the same **absolute** database path in the client's `--db` argument.

`pnpm dev` builds once and starts the default workspace on port 4587. It does not provide automatic watching or hot reload. For the isolated workspace above, stop the process, run `pnpm run build`, and repeat the explicit start command after edits.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/` | CLI, SQLite storage, transport, crawler, extraction, HTTP service, and MCP |
| `ui/` | React interface |
| `migrations/` | Versioned database schema |
| `tests/` | Original fixtures and behavior checks, including real stdio MCP |
| `scripts/` | Build, notice generation, packaging, and installation verification |
| `docs/` | User guides, architecture, release procedure, and verification evidence |
| `docs/history/` | Completed build notes, retained as historical context |

Generated `dist/`, `node_modules/`, `artifacts/`, and local workspace data are ignored. Never commit collected documentation, databases, backups, secrets, or machine specific MCP configuration.

## Check a change

Run the build and tests for application changes. For documentation changes, check command names against the CLI, verify relative links and relevant external destinations, and try any revised setup steps in a disposable workspace. Add a focused regression test when fixing behavior; avoid tests that only restate an implementation.

The test suite injects network fixtures. Production has no option that permits private network targets or disables collection isolation. Preserve those boundaries and keep the MCP tools read only. See [Architecture](docs/ARCHITECTURE.md).

For an installable artifact, follow the complete [release procedure](docs/RELEASING.md), including `pnpm run verify:package`. The release script does not build or test on your behalf.

## Issues and proposed changes

Use [GitHub Issues](https://github.com/agammann/sift/issues) for reproducible bugs or focused feature proposals. Include the Sift version, Node version, operating system, expected result, actual result, and minimal steps. Remove credentials, private URLs, database paths containing personal information, and document content before sharing logs.

Discuss substantial changes before implementing them. Keep proposed patches focused and describe how they were verified. Public source visibility does not grant an open source license; the project remains `UNLICENSED`, and licensing decisions belong to the repository owner.
