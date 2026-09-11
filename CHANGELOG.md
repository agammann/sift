# Changelog

## 0.1.0 — 2026-09-08

First local release: persistent project collections; bounded public HTML collection; explicit scope and version provenance; deterministic Markdown extraction; SQLite FTS5 search; exact-content index aliases; current/previous revision retention; conditional refresh and failure/unavailability history; cancellation and restart recovery; five allowlisted stdio MCP tools; loopback React management interface; profiles; SQLite-safe backup/restore; CLI diagnostics; bundled local archive and deterministic verification fixtures.

Known limits and actual validation are recorded in `docs/VERIFICATION.md`. This release does not select an owner license or claim production readiness.

Before release, bounded repeated heading metadata and total indexed text to prevent excessive resource consumption from malicious documentation. Initial indexing and reindexing share the same budgets, preserve full revision content, and report limits accurately. Added two regression tests and corrected the development command's UI path.
