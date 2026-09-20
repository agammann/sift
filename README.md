# Sift

**Clean documentation. Clear sources.**

Collect the public documentation your project needs, search it locally, and let your coding assistant retrieve passages with source URLs and revision history through MCP.

[Website](https://sift-docs.alx21.chatgpt.site/) · [Download 0.1.1](https://sift-docs.alx21.chatgpt.site/downloads/sift-local-0.1.1.tgz) · [Getting started](docs/GETTING_STARTED.md) · [MCP setup](docs/MCP.md)

## What Sift does

1. **Collect:** choose public documentation URLs, allowed paths, and optional version labels. Refresh manually when you need new content.
2. **Inspect:** search retained pages, open their original sources, compare refresh outcomes, and read previous revisions.
3. **Connect:** expose selected collections to a local coding assistant through five read only MCP tools.

Sift 0.1.1 is a local application for one user. Your collections live in a SQLite database on your computer. No Sift account, model API key, paid service, or telemetry is required. The public website provides information and downloads; the application runs on your machine.

## Quick start

Requires **Node.js 24.15 or later within the Node 24 release line**. Select Node 24 on the [official download page](https://nodejs.org/en/download), then open a new terminal and check `node --version`. Node 22 and Node 25 or later are not supported by this release. Windows has been tested; macOS and Linux execution has not yet been verified.

1. Download the [Sift archive](https://sift-docs.alx21.chatgpt.site/downloads/sift-local-0.1.1.tgz) and [SHA256 checksum](https://sift-docs.alx21.chatgpt.site/downloads/sift-local-0.1.1.tgz.sha256).
2. Put the archive in a new folder you will keep, and open a terminal in that folder. See the [installation guide](docs/GETTING_STARTED.md) for checksum commands and Windows instructions.
3. Extract and start Sift:

```sh
tar -xzf sift-local-0.1.1.tgz
node package/dist/cli.js version
node package/dist/cli.js doctor
node package/dist/cli.js start
```

Expect `Sift 0.1.1`, a doctor result with `"ok": true`, and a startup message containing `http://127.0.0.1:4587`.

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
| See what was tested and what remains unverified | [Current acceptance checks](docs/REAL_WORLD_VERIFICATION.md) · [0.1.0 report](docs/VERIFICATION.md) |
| Prepare a release | [Release procedure](docs/RELEASING.md) |
| See release history and dependency notices | [Changelog](CHANGELOG.md) · [Third party notices](THIRD_PARTY_NOTICES.md) |

## Scope and status

Sift collects public, server rendered UTF-8 HTML. It does not sign in to websites, render JavaScript, import PDFs, or refresh on a schedule. Collection profiles can be exported; profile import is not included. A successful fetch records when Sift checked a page, not whether the upstream content is current.

The management interface binds to `127.0.0.1`. MCP uses local stdio, with an explicit collection allowlist. The website address and management URL are not remote MCP endpoints.

Source is publicly visible, but an open source license has not been selected. The package is marked `UNLICENSED`. See the [verification report](docs/VERIFICATION.md) for the limits of the tested first release.
