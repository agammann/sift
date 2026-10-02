# Real-world verification: Sift 0.1.1

This is the September 19 record. See [October 2 verification](verification-2026-10-02.md) for the current 0.1.2 packaged workflow, mobile correction and dependency checks.

Checked on September 19, 2026, using Windows, Node 24.19.0, and pnpm 11.19.0. These are operator-run acceptance checks against live public documentation, not a study with recruited users or a claim of universal site compatibility.

## Starting from the public download

Downloaded the published 0.1.0 archive and checksum from the Sift website into a fresh folder. The SHA256 matched. Extracted the archive, ran version and doctor, then started it with a separate test database and port. The browser showed an empty workspace. Existing user collections were not used or modified.

## Live collection and retrieval

Created a collection and the Python source through the browser. Added the other two sources through the same local management API. All requests used the production transport, with its normal public-network and robots controls.

| Source | Scope and budget | Result |
| --- | --- | --- |
| [Python tutorial](https://docs.python.org/3/tutorial/index.html) | `/3/tutorial`, 3 pages, depth 1 | 3 pages retained; 17 URLs discovered. Correctly reported bounded collection because the page budget was reached. |
| [MCP SDK server](https://ts.sdk.modelcontextprotocol.io/server) | `/server`, 1 page, depth 0 | Completed; one page retained. |
| [Node.js errors](https://nodejs.org/api/errors.html) | `/api/errors.html`, 1 page, depth 0 | Completed; one page retained. |

Queries `interpreter`, `registerTool`, and `error code` returned passages from the expected sources. Opened a retained Python revision in the browser and verified its source URL, revision ID, hash, timestamps, and full text. The Python collection's incomplete-scope warning remained visible.

## Problems found and fixed

1. The 0.1.0 Connect configuration used a bare `sift` command and omitted the current database. An extracted installation without that command failed to launch with ENOENT, even though built in diagnostics passed. Version 0.1.1 generates absolute executable, CLI, and database paths, with the selected collection ID. A regression test launches the exact JSON rendered by Connect with an empty PATH and retrieves data from a custom workspace.
2. Search headings displayed raw Markdown link syntax from real documentation. Version 0.1.1 renders heading labels inline, without nested links, images, or source HTML. Verified the corrected display against the previously collected Python pages and checked the browser console for warnings/errors.
3. The setup documentation mixed packaged installation with development and omitted several expected outputs. The README now has a direct extraction quick start, with dedicated installation, MCP, operations, and development guides. Completed build notes are archived as history.

## Persistence, MCP, and recovery

Stopped the old management process and started 0.1.1 against the test database. All five documents and the collection survived, and doctor reported healthy SQLite integrity with no foreign-key errors.

Launched a real SDK stdio client using the new configuration and an empty PATH. All five tools passed: collection listing, profile retrieval, search, document reading, and change listing. Repeated the three queries above through MCP and read their retained revisions. Long documents correctly returned bounded content pages.

Refreshed the MCP SDK source again successfully. Created a verified backup, added a disposable collection, and restored the backup into the test workspace. The disposable collection disappeared, a recovery copy was reported, and the already-connected MCP reader still retrieved the original documentation. Database health remained good.

## Packaged installation

The 0.1.1 archive passed `pnpm run verify:package`: installation into a fresh temporary project with scripts disabled, version, doctor, packaged interface, management mutation, and real stdio MCP discovery and collection listing. The installed runtime did not depend on the source checkout.

## Automated regression checks

Production build and TypeScript checking passed. **18/18 tests passed**, including the two new regressions. The existing synthetic retrieval benchmark still returned **5/5 expected passages in the top three**. This small fixture score is not an estimate of general retrieval quality.

The [0.1.0 verification report](VERIFICATION.md) remains a historical record, including the scope of the earlier security review. These functional checks are not a new security audit.

## Limits of this verification

Windows execution was checked. macOS and Linux execution, third-party assistant UI enrollment, real customer onboarding, large-corpus load, disk exhaustion, and power-loss recovery were not tested in this pass. Websites can change their markup, availability, or robots rules. Sift still supports public server-rendered HTML only, and the application remains local and single-user.
