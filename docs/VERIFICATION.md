# Verification report — Sift 0.1.0

This report records actual local checks. It is not a claim of production readiness or a comparison against other retrieval products.

## Environment

Windows, Node 24.19.0, pnpm 11.19.0. Exact dependency versions are in package.json and pnpm-lock.yaml. macOS/Linux setup is documented but those operating systems were not executed locally. No production database, account, model API or paid service was used for fixtures.

## Automated checks

The TypeScript check and production backend/UI build passed. The deterministic suite passed **16/16 tests**:

1. Collection → crawl → ranked search, extraction of tables/code/warnings, aliases and metadata.
2. Source/version/collection isolation, malformed query rejection and request-bound cursors.
3. Changed content, previous revision reads, conditional 304 confirmation, failed-check preservation and accurate last-success timestamps, 410 removal and bounded retention.
4. Cancellation, source overlap rejection, exclusive writer lock and interrupted job recovery.
5. IPv4/IPv6 SSRF boundaries, obfuscated literals, scope escapes and production transport rejection.
6. Safe Markdown rendering: no raw scripts/iframes, unsafe links or image requests.
7. Consistent backup/restore, confirmation, invalid backup rejection and transaction rollback.
8. Migration backup/rollback and byte-identical refusal of a newer unsupported schema.
9. **Real child-process stdio MCP** initialization, discovery, collection listing, search and document retrieval; collection allowlist rejection on all four collection-bearing tools and invalid-input rejection.
10. Management Host/Origin/CSRF enforcement, session creation and collection mutation.
11. The original fixture retrieval benchmark below.
12. Mixed DNS answer rejection and socket destination mismatch/rebinding checks.
13. Redirect scope and private-destination rejection before a second request.
14. The production decompression pipeline rejects a compressed body expanding beyond 2 MB; its lookup pins the validated address.
15. A source below the 2 MB response limit with a heading near 1 MB retains its full revision while initial indexing and reindexing respect bounded metadata, passages and aggregate bytes.
16. Repeated multibyte metadata respects a 4 MB indexed text budget; independent chunk count limits stop at 2,048 with an explicit warning.

Network unit fixtures are isolated under tests. They do not provide a production safety override. The storage failure check injects a transactional exception; actual disk exhaustion, power loss and every OS locking failure have not been reproduced.

## Retrieval benchmark

All benchmark pages are original synthetic fixtures in `tests/fixtures/`. Metric: expected passage from the expected source/version in the top 3 results.

| Query | Expected evidence | Actual |
| --- | --- | --- |
| retry delay | 500 milliseconds | Pass |
| idempotency key | Never retry a payment | Pass |
| client setup | ExampleClient | Pass |
| configuration timeout | 15000 | Pass |
| compatibility bridge | legacy adapter | Pass |

**Result: 5/5 (100%) on these five fixture queries.** This is a small regression benchmark, not a general retrieval quality estimate. No external baseline or comparative score was fabricated.

## Browser and live transport checks

The real local interface was opened in Codex's built-in browser. The test created a collection and a one-page source for `https://example.com/` with depth 0. The production transport completed collection; the UI displayed the persisted result. Search for `documentation` returned the actual page with its source URL, unknown version, revision ID, check/fetch timestamps and the body-fallback extraction warning. Full cleaned-content inspection showed the original evidence link, SHA-256 and source-reported modification date.

The UI's MCP diagnostics passed initialization and discovered all five tools. A UI-created backup passed validation; restoring the disposable test workspace showed a successful restore and an automatic recovery-copy path. This is a live transport smoke check, not evidence of broad documentation-site compatibility.

## Packaged clean installation

`pnpm run verify:package` passed after installing the produced `.tgz` in a fresh temporary project with install scripts disabled. It verified the installed version, a new persistent SQLite database and doctor result, the packaged HTTP interface, a real management mutation, and a real child-process MCP initialization/discovery/collection call. The installed artifact had no runtime dependency on the source checkout. Its local test process and temporary installation were removed afterward.

The generated visual concept and actual browser screenshot were inspected directly. The primary screen uses the requested neutral palette, green accent, source table and scoped form. Browser verification uses actual test state; no production statistics or collection content are seeded into a new installation.

## Security review and remediation

Codex Security completed a static review of source revision `8ec7640c95965fd46de80c9370a62dc03c485b4f`. It recorded one medium severity resource consumption finding: a long heading could be repeated across every indexed passage. Two independent reviewers identified the same control failure and the parent verified its source path. Coverage is explicitly partial: 42 of 44 tracked files were fully reviewed; the lockfile and generated dependency notices received structural and consumer review only. Dependency internals and external advisories were not audited.

The delivered source fixes the finding. Search heading metadata is limited to 512 characters, passages to 16,000 characters, and each document to 2,048 chunks and 4 MB of indexed UTF-8 text including repeated titles and headings. Both extraction and source reindexing use these limits. Complete revision content remains available, and extraction warnings explain shortened metadata, split blocks and index limits. Redundant initial chunk writes were removed. The two regression checks above passed against the corrected code. This is targeted remediation verification, not a second complete security audit.

The development command now builds and starts the packaged UI path. The archived security report refers to the earlier source revision and intentionally preserves its original finding.

## Known limitations and remaining release gates

- An owner-selected license and ownership metadata remain unset. Public source visibility alone is not an open-source license.
- Windows was tested; macOS/Linux execution remains a release validation gate before claiming those platforms verified.
- Generic extraction can retain site-specific layout and cannot recover content rendered only by JavaScript. UTF-8 public HTML only; no authentication, PDFs or browser rendering.
- Metadata redirects are conservative; robots crawl-delay above one second stops collection with an explanation. No automatic retries, schedules or proxy support.
- Exact content shares indexed representatives within a source; independent revision bodies remain stored per URL to preserve evidence.
- Job/change records require source/collection deletion for pruning; retained successful document revisions are bounded. Storage pressure needs monitoring for long-lived frequent refreshes.
- Profiles are Sift's versioned export format; profile import is not included. Backups restore the whole workspace.
- Source URL/scope/version changes require creating a new source and deleting the old one after inspecting the replacement. This avoids rewriting the identity of existing evidence.
- No exhaustive adversarial network audit, OS crash/power-loss testing, large-corpus load testing or external human security audit has been performed. The bounded automated security review above does not establish those guarantees.

No packages or hosted application were published by the release scripts.
