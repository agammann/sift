# October 2, 2026 UTC verification

Local environment: Windows, Node 24.19.0, pnpm 11.19.0 and Playwright Chromium 153.0.8010.12. All acceptance work used a new extracted archive and a separate disposable database. Existing collections were not used.

## Packaged application and live sources

The 0.1.2 archive passed installation into a fresh temporary project, version, doctor, the packaged interface, a management mutation and actual stdio MCP discovery/listing. It runs without development dependencies or the source checkout.

The extracted archive also passed a browser walkthrough: create the first collection, add and refresh three live public sources, search each source, open a retained revision with its original URL and SHA-256, inspect refresh outcomes, view changes and run the built-in MCP diagnostic. Each source used a one-page budget, depth zero and concurrency one:

| Public source                                                    | Allowed path       | Retained pages | Search          |
| ---------------------------------------------------------------- | ------------------ | -------------- | --------------- |
| [Example Domain](https://example.com/)                           | `/`                | 1              | `documentation` |
| [Python tutorial](https://docs.python.org/3/tutorial/index.html) | `/3/tutorial`      | 1              | `interpreter`   |
| [Node.js errors](https://nodejs.org/api/errors.html)             | `/api/errors.html` | 1              | `error code`    |

The crawl used the ordinary production transport, including DNS/private-address checks, path scope, robots policy and request limits. These bounded results do not establish complete documentation coverage or general retrieval quality.

## MCP, persistence and recovery

A separate SDK client launched the configuration actually rendered by Connect, with an empty PATH. All five tools returned successful results: `list_collections`, `get_collection_profile`, `search_docs`, `read_document` and `list_changes`. Document pagination returned different successive content pages. A collection outside the explicit allowlist returned `forbidden_collection`.

Codex app-server 0.159.2 then launched that extracted installation through its native stdio MCP configuration, using an ephemeral runtime with the management server stopped. All five tools passed through Codex's `mcpServer/tool/call` API. Search returned the retained Python tutorial and original source URL. Successive document pages differed, and the unexposed collection returned `forbidden_collection`. This exercises the actual Codex host without changing the user's saved server configuration; no model conversation or inference request was run.

The interface created a verified online backup, added a temporary collection, and restored the backup while the MCP reader remained connected. The added collection disappeared and the original retained revision was still retrievable. After stopping the server, CLI doctor passed. Restarting the same extracted installation preserved the restored collections and revision IDs.

## Corrections and automated checks

At 320 pixels, the collection header action and tab row extended beyond the viewport. The header and tabs now wrap. The extracted interface passed Connect layout checks at 1440, 390 and 320 pixels with no horizontal overflow or page errors.

The initial complete dependency audit reported three moderate advisories in `fast-uri` and `ip-address`. Compatible updates reduced the audit to zero known advisories at all severity levels. Notice generation now follows the installed dependency graph, excluding obsolete versions retained in pnpm's store.

Production build and TypeScript checks passed. All 18 existing tests passed, including actual stdio MCP, collection isolation, refresh/recovery, safe rendering and network boundaries. The fixture retrieval benchmark returned 5/5 expected passages in the top three; this is a small deterministic fixture score.

The [verified workflow run](https://github.com/agammann/sift/actions/runs/36968089195) passed frozen installation, notice generation, build, all 18 tests, complete dependency audit, release creation and clean package verification on Windows, Ubuntu 22.04 and macOS with Node 24.19.0. Each platform installed its archive into a fresh temporary project and verified version, persistent database, doctor, the packaged HTTP interface, a management mutation and actual stdio MCP initialization/discovery/listing. The complete rendered browser walkthrough above ran on Windows.

Assistant UI enrollment and model use of retrieved material, independent participant onboarding, large-corpus load, disk exhaustion and power-loss recovery remain unverified. Sift supports public server-rendered HTML only. Its public website is a download/information page, and its management address is not an HTTP MCP endpoint.
