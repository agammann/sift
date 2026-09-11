# Architecture and collection policy

The CLI starts either the loopback management service or an independent read-only stdio MCP server. Both use the same persistent SQLite file. One management writer is allowed, with SQLite WAL readers and full synchronous writes. A process lock prevents concurrent management/restore/migration operations; a partial unique index prevents overlapping jobs on one source.

## Storage

Schema migration 001 separates collections, sources, jobs, page outcomes, documents, revisions, search chunks and change events. IDs use UUIDs for entities and SQLite integers for ordered events/chunks. Original and validated in-scope canonical URLs remain distinct. Canonical declarations cannot merge source/version boundaries. Version provenance is either a user-supplied label or unknown.

Documents retain per-page checks and their last successful revision. Revisions contain cleaned Markdown, headings, language, warnings, a SHA-256 content/metadata hash, fetch time and source-reported Last-Modified when present. Retention defaults to current and previous successful revisions and can be set from 2 to 20 per source. Exact current document hashes share one indexed representative within each source; URLs remain independently inspectable aliases with their own fetch history. Identical data is never merged across sources or version labels. Revision bodies are retained per document to preserve independent evidence.

FTS5 weights titles/headings/passages 8:4:1. Content, revision pointers and indexes change in one transaction. Active current revisions are indexed; historical and confirmed-unavailable revisions are accessible only through document inspection. A source-level incomplete status is included in evidence warnings alongside per-document outcomes.

## Network boundaries

Only HTTP/HTTPS without embedded credentials. Literal IPs and every DNS answer must be public unicast. Localhost names, private, loopback, link-local, carrier NAT, reserved/documentation ranges, multicast and metadata destinations are blocked for IPv4 and IPv6. The transport pins a validated DNS address and checks the actual socket address, including after redirects. It does not honor proxy environment variables. TLS retains Node's normal certificate and hostname verification. No private-network override exists.

Content requests and redirects remain within the exact configured origin and allowed path segments. Encoded separators/double encoding are conservatively rejected. Robots and sitemap metadata are fetched only on the same source origin at their explicit metadata URLs, using the same protected transport. Redirects for metadata are conservatively denied unless they remain the identical metadata URL. This can reject a site that relocates robots/sitemaps; the outcome is shown.

## Budgets and robots

Defaults: 50 page attempts, depth 3, concurrency 2, at least 1 second between request starts per origin, 15-second request deadline including redirects/body, 2 MB decompressed responses. Configurable hard maxima: 500 pages, depth 6, concurrency 2. Additional caps: 5-minute jobs, 4 concurrent source jobs, 4 redirects, zero automatic retries, 2,000 discovered URLs, 10 query variants per path, 5 sitemap files and 2,000 sitemap locations. Tracking parameters/fragments are removed; meaningful query values remain.

Sift sends an identifying User-Agent, checks robots before fetching content, and treats unavailable robots conservatively. A robots 404 permits collection; 401/403/429/5xx stop it. A robots crawl-delay over 1 second currently causes a clear unsupported-delay outcome instead of violating it. Retry-After delays future starts on the origin; no immediate retry is attempted. A request waiting longer than its deadline fails and can be manually retried later.

Discovery combines the seed, known document URLs, bounded sitemaps and internal links. Known pages are rechecked despite sitemap absence. A bounded or interrupted crawl never marks unvisited URLs as deleted. Budget outcomes and sitemap warnings are persisted.

## Extraction and rendering

Cheerio selects main/article landmarks or falls back to body with an explicit warning. Standard navigation, headers/footers, cookie banners, ads, scripts, forms and sidebars are removed. This is deterministic generic extraction, not a site-trained quality classifier. Unusual site-specific repeated layout can remain and should be inspected. Tables, code examples, headings, links and warnings are retained. Images are omitted to avoid tracking and unsupported remote image loads. Only UTF-8/ASCII server-rendered HTML is supported.

Chunks follow headings and paragraph boundaries, targeting roughly 1,800 characters. Code fences stay together except blocks over 16,000 characters, which are split with a warning. Search passages over 5,000 characters explicitly report shortening; full revisions remain paginated. The local renderer rejects raw HTML, unsafe link schemes and remote images. Source text is never evaluated.

## Local security

HTTP binds to 127.0.0.1. Exact Host, Origin and cross-site Fetch Metadata checks reject hostile browser origins. Mutations require a random local-session header token and JSON content type, with a 64 KB request cap. Responses use CSP, no-store, no-sniff and no-referrer headers. These defenses target browser cross-site attacks; Sift is single user and does not isolate other processes running as the same OS user.

Deferred: JavaScript/browser rendering, authenticated pages, PDFs, embeddings, answers, accounts, remote hosting, teams, schedules and telemetry. Unsupported inputs produce explicit collection outcomes.
