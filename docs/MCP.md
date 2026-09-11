# Connect Sift through MCP

Sift uses the official `@modelcontextprotocol/sdk` **1.30.0**, pinned with its lockfile. API references were checked against the official [server](https://ts.sdk.modelcontextprotocol.io/server) and [client](https://ts.sdk.modelcontextprotocol.io/client) documentation. The SDK manages initialization, protocol validation, discovery and stdio framing.

## Direct Node configuration

Use absolute paths when a client cannot find shell commands or cannot execute Windows `.cmd` shims:

```json
{
  "mcpServers": {
    "sift": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Tools\\sift\\package\\dist\\cli.js",
        "mcp",
        "--db", "C:\\Users\\YOUR_NAME\\AppData\\Local\\Sift\\sift.sqlite",
        "--collections", "YOUR_COLLECTION_ID"
      ]
    }
  }
}
```

Those paths are placeholders. Use your installed Node executable, actual extracted package location and actual collection ID. On macOS/Linux use `/absolute/path/to/node` and `/absolute/path/to/package/dist/cli.js` if needed. Multiple explicit IDs can be comma separated in one argument.

For Codex, use equivalent TOML in its MCP configuration, as described in the [official OpenAI MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli):

```toml
[mcp_servers.sift]
command = "node"
args = ["/absolute/path/to/package/dist/cli.js", "mcp", "--collections", "YOUR_COLLECTION_ID"]
```

If using the default data directory, `--db` may be omitted. Connect diagnostics use the active workspace path and launch a real SDK client and child server. They verify initialization, discovery and collection listing. The automated integration test additionally performs actual `search_docs` and `read_document` wire calls.

## Tool contract

| Tool | Inputs | Result |
| --- | --- | --- |
| `list_collections` | none | Explicitly exposed collections only |
| `get_collection_profile` | collection_id | Sift's versioned collection profile |
| `search_docs` | collection_id, query, optional source_id/version/limit/cursor | Ranked passages with IDs, source URLs, aliases, version labels, timestamps and warnings |
| `read_document` | collection_id, document_id, optional revision_id/cursor/max_chars | Retained revision content and a next cursor |
| `list_changes` | collection_id, optional since/limit/cursor | Added, changed, restored, failed-check and confirmed-unavailable events |

Outputs contain both protocol text content and `structuredContent`, matching the declared output schema. Successful results use `{ok:true,data:{...}}`. Controlled tool errors use `isError:true` and `{ok:false,error:{code,message}}`. Invalid schema inputs are rejected by the SDK; no matches return `status: "no_matches"`, which is not an internal error. Missing or expired revisions use `missing_content`.

Search uses AND semantics for at most 30 Unicode words/numbers, not raw SQLite query syntax. Limits: 20 search results, 5,000 characters per passage, 2,000 ranked candidates; document reads default to 12,000 and max out at 20,000 characters; change pages have at most 100 entries. Cursors bind to their request/document revision and reject malformed values. Search/change pagination can shift if the database changes between requests; document pagination binds to an immutable retained revision.

Every collection-bearing tool checks the server's allowlist before accessing data. Read-only mode does not migrate or recover jobs. Stdout is exclusively reserved for MCP messages; process diagnostics go to stderr. Documentation text remains untrusted evidence. The server never executes examples, follows source instructions or fetches arbitrary URLs from tool requests.
