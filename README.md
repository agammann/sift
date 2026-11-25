# Sift

**Clean documentation. Clear sources.**

Collect the public documentation your project needs, search it locally, and let your coding assistant retrieve passages with source URLs and revision history through MCP.

[Website](https://sift-docs.alx21.chatgpt.site/) · [Download 1.0.3](https://github.com/agammann/sift/releases/download/v1.0.3/sift-local-1.0.3.tgz) · [Getting started](docs/GETTING_STARTED.md) · [MCP setup](docs/MCP.md)

## What Sift does

1. **Collect:** choose public documentation URLs, allowed paths, and optional version labels. Refresh manually when you need new content.
2. **Inspect:** search retained pages, open their original sources, compare refresh outcomes, and read previous revisions.
3. **Connect:** expose selected collections to a local coding assistant through five read only MCP tools.

Sift 1.0.3 is a local application for one user. Your collections live in a SQLite database on your computer. No Sift account, model API key, paid service, or telemetry is required. Current immutable archives and checksums are available from GitHub Releases. The companion website retains versioned downloads; the application runs on your machine.

## Quick start

Requires **Node.js 24.15 or later within Node 24, or 26.13.1 or later within Node 26**. Select a supported release line on the [official download page](https://nodejs.org/en/download), then open a new terminal and check `node --version`. Other major versions are unsupported. The release workflow checks source and the same Linux-built archive on Windows, Ubuntu 22.04 and macOS at both supported Node floors. The browser walkthrough has been exercised on Windows; see the [v1 contract](docs/V1.md) and dated [verification record](docs/verification-v1.md) for scope. The older published 1.0.2 archive supports Node 24 only.

1. Download the [Sift archive](https://github.com/agammann/sift/releases/download/v1.0.3/sift-local-1.0.3.tgz) and [SHA256 checksum](https://github.com/agammann/sift/releases/download/v1.0.3/sift-local-1.0.3.tgz.sha256).
2. Put the archive in a new folder you will keep, and open a terminal in that folder. See the [installation guide](docs/GETTING_STARTED.md) for checksum commands and Windows instructions.
3. Extract and start Sift:

```sh
tar -xzf sift-local-1.0.3.tgz
node package/dist/cli.js version
node package/dist/cli.js doctor
node package/dist/cli.js start
```

Expect `Sift 1.0.3`, a doctor result with `"ok": true`, and a startup message containing `http://127.0.0.1:4587`.

4. Open **http://127.0.0.1:4587** in your browser. Keep the terminal running. Press **Ctrl+C** to stop.

The archive includes the built interface and backend. This quick start requires neither cloning the repository nor installing development dependencies. To start Sift next time, run `node package/dist/cli.js start` from the same folder. Collections persist between runs.

### Install the packaged release

If you prefer a `sift` command, the [installation guide](docs/GETTING_STARTED.md#optional-install-the-sift-command) covers installation with npm. The downloadable `.tgz` is the release package; Sift is not published to the npm registry.

## Your first collection

1. Choose **Create your first collection** and give it a name.
2. Choose **Add source**. Enter a public documentation **Start URL** and matching **Allowed paths**, such as `/docs`. Use commas for multiple paths.
3. Choose **Save source**, then **Refresh**. Saving alone does not fetch pages. Use **Inspect** to see outcomes and warnings.
4. Open **Search** and try a word you know appears on a collected page. Open a result to read the retained revision and source details.
5. Open **Connect**, choose **Test MCP connection**, then follow the [MCP setup guide](docs/MCP.md) to configure your assistant.

For a small, repeatable walkthrough, use the [one page first collection](docs/GETTING_STARTED.md#try-a-one-page-collection). The built in connection test checks Sift's MCP process; your assistant still needs its own configuration.

## Documentation

| I want to… | Read |
| --- | --- |
| Install, verify the download, and collect my first page | [Getting started](docs/GETTING_STARTED.md) |
| Connect Codex or another local MCP client | [MCP setup and tool reference](docs/MCP.md) |
| Find my data, back it up, upgrade, or troubleshoot | [Operations](docs/OPERATIONS.md) |
| Build from source or propose a change | [Development and contributions](CONTRIBUTING.md) |
| Understand crawling, storage, and access boundaries | [Architecture](docs/ARCHITECTURE.md) |
| Understand supported sources, stable interfaces and upgrade | [v1 contract](docs/V1.md) |
| See what was tested and what remains unverified | [November 17 local checks](docs/verification-2026-11-17.md) · [v1 checks](docs/verification-v1.md) · [October 2 acceptance checks](docs/verification-2026-10-02.md) · [0.1.1 checks](docs/REAL_WORLD_VERIFICATION.md) · [0.1.0 report](docs/VERIFICATION.md) |
| Prepare a release | [Release procedure](docs/RELEASING.md) |
| See release history and dependency notices | [Changelog](CHANGELOG.md) · [Third party notices](THIRD_PARTY_NOTICES.md) |

## Scope and status

Sift collects public, server rendered UTF-8 HTML. It does not sign in to websites, render JavaScript, import PDFs, or refresh on a schedule. Collection profiles can be exported; profile import is not included. A successful fetch records when Sift checked a page, not whether the upstream content is current.

The management interface binds to `127.0.0.1`. MCP uses local stdio, with an explicit collection allowlist. The website address and management URL are not remote MCP endpoints.

Sift’s own source and bundled release are available under the [MIT License](LICENSE). Third-party dependencies retain their original licenses in [Third party notices](THIRD_PARTY_NOTICES.md). See the [v1 contract](docs/V1.md) for supported use and the initial release stopping point.
