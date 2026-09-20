# Sift 0.1.0 implementation plan

Historical build notes. For current installation instructions, use [Getting started](../GETTING_STARTED.md). For ongoing development, use [Development and contributions](../../CONTRIBUTING.md).

The original build scope below predates the public companion website. The [website](https://sift-docs.alx21.chatgpt.site/) now provides information and downloads; Sift itself remains a local application.

1. [complete] Persistent schema, safe transport, deterministic extraction, bounded jobs and refresh history.
2. [complete] Ranked retrieval, explicit collection isolation, real stdio MCP integration.
3. [complete] Local management UI, CLI, backup/restore and diagnostics.
4. [complete] 16 deterministic tests, 5/5 fixture retrieval benchmark, browser live-transport check, packaged clean installation and release documentation.
5. [complete] Codex Security review and targeted remediation, public GitHub repository preparation, source archive and final delivery preparation. Public source publication was explicitly authorized after the original brief.

Scope: local single user, public server-rendered HTML, Node 24, TypeScript, SQLite FTS5, React/Vite, official MCP SDK. Public GitHub source repository only; no hosted deployment, package publication, paid resources, accounts or model services. Empty repository inspected; no pre-existing files changed.

Design: white workspace, pale gray 230px sidebar, forest green #236447, dark gray #202823, thin #e0e5e1 separators, 6px radii. System sans; 32px page title, 15px body, 13px metadata. Tables and stacked forms; Sources, Search, Changes, Connect tabs. Keyboard focus rings and responsive single-column layout. Real empty states; no seeded user data.

SDK reference checked: https://ts.sdk.modelcontextprotocol.io/server and /client. Pin available maintained v1 SDK 1.30.0; use registerTool, structuredContent, StdioServerTransport and a real StdioClientTransport test.
