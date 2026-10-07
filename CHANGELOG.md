# Changelog

## 1.0.0

Defined the bounded local documentation/MCP contract, supported-source matrix and backup-first upgrade from 0.1.2. Sift's own source and bundled release are now MIT licensed; third-party notices retain their original licenses.

Updated MCP SDK to 1.31.0 and patched the compatible proxy-addr and source-map-js dependencies. Collection behavior, SQLite schema, extraction, search and five read-only MCP tool names remain unchanged.

Separated the mobile collection-deletion action from the footer explanation so the destructive control remains clear.

Added an immutable GitHub release archive with SHA256 sidecars. Publication requires source checks and fresh package installation on Windows, Linux and macOS. All three platforms check the exact Linux-built archive before it is published. The archive includes the UI, bundled backend, documentation, migrations, examples and license; it needs Node 24 and no runtime npm installation.

## 0.1.2 — 2026-10-02

Updated compatible `fast-uri` and `ip-address` dependencies used by the MCP SDK. The complete dependency audit now reports no known advisories. The release bundles the updated runtime.

Added Windows, Linux and macOS automation for frozen installation, build, the existing test suite, dependency audit, archive creation and installation into a fresh project. Packaged verification exercises the UI service and actual stdio MCP without depending on the source checkout.

The collection header and tabs now wrap on small screens, keeping Add source and Connect reachable at 320 pixels. Notice generation follows the installed dependency graph instead of including obsolete versions left in pnpm's store.

## 0.1.1 — 2026-09-19

Fixed copied MCP configuration for extracted installations, Windows command lookup, and custom workspaces. Connect now includes the absolute Node executable, Sift CLI, database path, and selected collection. A regression check launches the exact rendered configuration with an empty PATH and reads fixture evidence from the intended workspace.

Search headings now display Markdown as safe inline text instead of exposing raw link syntax. Added an inline-rendering regression check. The UI version follows the backend version, and packaged verification follows package.json rather than a fixed archive name.

Reorganized the README, added a complete first-use walkthrough and development guide, clarified MCP setup and recovery, and archived the completed build plan. See [real-world verification](docs/REAL_WORLD_VERIFICATION.md) for the tested sites, results, and remaining limits.

## 0.1.0 — 2026-09-08

First local release: persistent project collections; bounded public HTML collection; explicit scope and version provenance; deterministic Markdown extraction; SQLite FTS5 search; exact-content index aliases; current/previous revision retention; conditional refresh and failure/unavailability history; cancellation and restart recovery; five allowlisted stdio MCP tools; loopback React management interface; profiles; SQLite-safe backup/restore; CLI diagnostics; bundled local archive and deterministic verification fixtures.

Known limits and actual validation are recorded in `docs/VERIFICATION.md`. This release does not select an owner license or claim production readiness.

Before release, bounded repeated heading metadata and total indexed text to prevent excessive resource consumption from malicious documentation. Initial indexing and reindexing share the same budgets, preserve full revision content, and report limits accurately. Added two regression tests and corrected the development command's UI path.
