# Sift

**Clean documentation. Clear sources.**

Sift turns selected public documentation sites into persistent project collections. Search the collected evidence in a local interface, inspect source URLs and retained revisions, and give a coding assistant access through five read-only MCP tools.

Sift 0.1.0 is a local, single-user first release. It uses TypeScript, Node.js 24, SQLite FTS5, React/Vite and the official MCP TypeScript SDK. No account, paid service, model API key or telemetry is involved.

## Install the packaged release

Requires **Node.js 24.15 or later in the Node 24 line**. Node 22 and Node 25+ are not supported by this release. Node's built-in SQLite avoids platform-specific native npm addons.

With a local copy of `sift-local-0.1.0.tgz`:

```sh
npm install --global ./sift-local-0.1.0.tgz
sift version
sift doctor
sift start
```

On Windows, use `npm.cmd` / `sift.cmd` if PowerShell execution policy blocks command scripts. Open **http://127.0.0.1:4587**. Keep the terminal running; Ctrl+C stops the management service and cancels active jobs. There is no background refresh scheduler in this release. A separately launched stdio MCP server can read stored data while the management service is stopped.

Alternatively, extract the archive and run without installing:

```sh
tar -xzf sift-local-0.1.0.tgz
node package/dist/cli.js start
```

The packaged backend and interface are bundled. Installation downloads no runtime dependencies and runs no install scripts. The source checkout needs the pinned development dependencies to build.

## First collection

1. Choose **Create your first collection** and enter your project's name.
2. Choose **Add source**. Enter a public documentation URL and explicit allowed paths, such as `/docs` and `/guides`.
3. Optionally supply a version label. Sift records its provenance as user supplied; it never guesses a software version.
4. Review the limits and choose **Save source**. This saves configuration without fetching.
5. Choose **Refresh**. **Inspect** shows progress, cancellation, documents, individual outcomes and recent jobs.
6. Use **Search**, filter by source/version, and open a passage to inspect its full revision and original evidence.
7. Use **Connect** to export a profile, get an MCP configuration and test a real stdio connection.
8. Refresh manually to record changes. Use **Backup & restore** to protect the whole workspace.

A partial collection is useful but incomplete. A failed check preserves previous successful content with a warning. Only an actual 404 or 410 confirms unavailability. Sitemap absence does not imply deletion. A fetch timestamp does not prove upstream documentation is current.

## Data and commands

Data is independent of the repository and working directory:

| Platform | Default directory | Verification |
| --- | --- | --- |
| Windows | `%LOCALAPPDATA%\Sift` | Tested locally on Windows with Node 24.19.0 |
| macOS | `~/Library/Application Support/Sift` | Documented; not executed on macOS in this build |
| Linux | `$XDG_DATA_HOME/sift`, or `~/.local/share/sift` | Documented; not executed on Linux in this build |

Set `SIFT_DATA_DIR` or pass `--db ABSOLUTE_PATH` to every relevant command to use another workspace. MCP and management must point at the same database. The Connect diagnostics automatically use the current database.

```sh
sift start --port 4587
sift mcp --collections COLLECTION_ID
sift doctor
sift backup /absolute/path/new-backup.sqlite
sift restore /absolute/path/backup.sqlite --confirm "REPLACE ALL DATA"
sift version
```

The UI can back up while running. Stop the management service before using CLI commands that acquire its writer lock. Backups refuse to overwrite an existing file. Restore validates and stages the backup, saves a recovery copy, then replaces data in a SQLite transaction. Explicit confirmation is required. Existing MCP clients keep the same SQLite file and see the committed restored contents; collection allowlists continue to apply.

## MCP

```json
{
  "mcpServers": {
    "sift": {
      "command": "sift",
      "args": ["mcp", "--collections", "YOUR_COLLECTION_ID"]
    }
  }
}
```

Replace the ID using the Connect tab. No collections are exposed by default. There are no management or URL-fetching MCP tools. See [MCP setup](docs/MCP.md) for Windows direct-node configuration, Codex TOML and diagnostics.

## Develop and verify

```sh
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm test
node scripts/notices.mjs
pnpm run release
```

If Corepack is unavailable, install the exact pnpm version through npm. `pnpm-workspace.yaml` allows esbuild's required install step. The lockfile is part of the source repository. Run `pnpm run build` after source changes, then `pnpm start`; the backend serves the built Vite interface. The release script packages the current built output; always build and test immediately beforehand.

The source is split into storage, network transport, extraction, crawl orchestration, MCP, CLI, HTTP management and React feature components. Tests inject a fixture transport directly; there is **no production flag for private-network access or test fixtures**.

## Documentation and release status

- [Architecture and collection policy](docs/ARCHITECTURE.md)
- [MCP connection guide](docs/MCP.md)
- [Upgrade, backup and recovery](docs/OPERATIONS.md)
- [Verification results and limitations](docs/VERIFICATION.md)
- [Release procedure](docs/RELEASING.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Ownership details and an open-source license have not been selected. `UNLICENSED` is package metadata indicating that this release does not grant an open-source license; it is not an invented ownership claim. Public source visibility does not itself grant an open-source license. This release should not be described as production ready solely because its build and tests pass.
