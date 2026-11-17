# November 17, 2026 local verification

This record describes the local checks for the 1.0.3 delivery. Earlier verification records and immutable archives remain historical evidence. This is not a comparative retrieval benchmark or an independent security certification.

## Environment and source checks

Native Windows x64 used Node 24.22.1 and pnpm 11.19.0, including nested package-manager calls. The source build passed TypeScript checking and the production backend/UI build. All 18 application tests and 12 publisher-safeguard tests passed. The full locked dependency audit returned no known advisories at the time of the check.

The actual installed build graph uses Vite 8.3.7 and Rolldown 1.2.18. The official MCP SDK is 1.32.2 with local stdio transport. No dependency or transport-policy change was needed for this delivery.

The notice generator was corrected to acknowledge Sift's existing MIT license. Regeneration followed the actual installed graph: 247 package versions, with seven stale build-tool versions replaced by their current versions. The 240 shared package/license sections were unchanged after line-ending normalization. Upstream licenses remain separate from Sift's own license.

## Packaged local workflow

The complete browser workflow used a package built from the then-current checkout (`12a174616b0cf8d2a46efa394b8b0d9b6f96c772`, version 1.0.2), not the older immutable published 1.0.2 archive. It ran against a new explicitly selected database, leaving the default workspace untouched. The 1.0.3 application-code change is the version constant; other changes are current guides and notices.

- The extracted CLI reported its version and a healthy empty schema-1 database before startup.
- A user-created collection refreshed the actual public `https://example.com/` source through production networking, limited to one page, depth zero and concurrency one. Inspect showed the successful page and the expected body-fallback warning. Search returned retained text with its source URL and revision; changes included the added event.
- The browser's child-process MCP diagnostic discovered five tools. The copied configuration exactly matched the clipboard, used absolute executable/database paths and exposed only the selected collection.
- A separate genuine SDK stdio client used that exact configuration with management stopped. All five tools, a two-page read of one retained revision, selected-only listing and `forbidden_collection` for the unshared collection passed. Database bytes remained unchanged.
- An online backup was verified and restored through the interface into a separate doctor-confirmed empty workspace. Both collections, the retained document/revision/hash and search survived. All eight logical application tables matched. The original workspace was not replaced, and recovery copies were retained.
- Both workspace doctors reported schema 1 and integrity OK, with two collections and one document. Both browser workflows reported no console warnings or errors.

The packaged 1.0.3 installation check also passed in a fresh temporary project: scripts-disabled archive installation, version, doctor, packaged UI, management mutation and genuine stdio MCP initialization/discovery/listing, without source-checkout runtime dependencies. The bundled package has no runtime npm dependencies or install scripts.

A new 1.0.3 extraction was then started against the retained QA database, preserving the baseline installation. Actual browser reload retained both collections and the exact search/revision/hash; the UI diagnostic found five tools, and the clipboard configuration used the new CLI path exactly. With management stopped, a separate genuine SDK client reported `sift/1.0.3`, used all five tools, denied the unshared collection, read the exact retained revision in two pages and left database bytes unchanged. Final doctor reported integrity OK, no foreign-key errors, two collections and one document. Both managers were stopped with their data and backups retained.

## Delivery and limits

The [release workflow](https://github.com/agammann/sift/actions/workflows/check.yml) separately requires source and exact-archive installation checks on Windows, Ubuntu 22.04 and macOS with Node 24.15.0 and 26.13.1. It also gates the Node declaration floor, Node 24-to-26-to-24 data compatibility and release-publication safeguards. This local record does not substitute for those exact-commit remote gates.

The public Example Domain check established one small production-path collection, not broad documentation quality or upstream freshness. Refresh/change/removal/retention and network-boundary edge cases remain separately identified fixture tests. No new installed assistant-host configuration, model call, paid API, sign-in source, private-target bypass or external write was used. The companion website is maintained and verified separately.
