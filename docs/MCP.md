# Connect Sift through MCP

[Back to the README](../README.md)

Sift provides five read-only tools over **local stdio**. Your assistant starts the MCP process on the same computer as Sift's database. Neither the public website nor the browser's management address is an HTTP MCP endpoint.

## Connect an existing collection

1. [Install and start Sift](GETTING_STARTED.md), create a collection, and refresh a source. Verify that Search finds a passage.
2. Open that collection's **Connect** tab and choose **Test MCP connection**. Expect successful initialization and five tool names. This checks Sift itself, not your assistant's configuration.
3. Choose **Copy configuration**. It includes the absolute Node executable, installed CLI, database file, and selected collection ID. Extracted archives do not require a global sift command.
4. Add the server to your local assistant's MCP settings, preserving any existing servers. Restart or reconnect the assistant's MCP server.
5. Ask the assistant to use Sift's list_collections, then search_docs for a term you already found in Sift. Check that its answer contains the expected source URL. Use read_document for the complete retained revision.

Keep the installation folder in place. If you move Sift, update Node, or select another database, copy a fresh configuration. Collection IDs are UUIDs shown in the generated configuration; names are not IDs. Multiple allowed IDs can be comma separated in the collections argument. No collections are exposed by default.

## Codex configuration

Codex stores MCP servers in config.toml. Its default user file is ~/.codex/config.toml; on Windows this is usually %USERPROFILE%\.codex\config.toml. See the [official OpenAI MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

Add the following table, using the **command and args values from Sift's Connect tab**. This is an example with placeholders, not a configuration to paste unchanged:

```toml
[mcp_servers.sift]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Tools\Sift\package\dist\cli.js', 'mcp', '--db', 'C:\Users\YOUR_NAME\AppData\Local\Sift\sift.sqlite', '--collections', 'YOUR_COLLECTION_ID']
```

Single quoted TOML strings preserve Windows backslashes. JSON clients use the JSON copied from Connect, which escapes backslashes automatically. On macOS/Linux, use the absolute executable and file paths for that computer. The built in JSON configuration is not itself TOML.

The management interface can be stopped after collection; MCP reads the persisted database independently. Refreshing sources still requires the management process. No OpenAI API key is needed by Sift; your assistant may have its own account requirements.

On October 2, 2026, Codex app-server 0.159.2 on Windows launched the extracted 0.1.2 archive and successfully called all five tools. Search returned the collected Python tutorial with its source URL; document pagination and collection isolation also passed. This verifies the Codex host's MCP connection and tool execution. It does not establish another assistant's setup or how a model uses retrieved material. See the [verification record](verification-2026-10-02.md).

## If the connection fails

| Symptom | What to check |
| --- | --- |
| Executable not found or ENOENT | Copy configuration from the installed Sift app; check that Node and the CLI still exist at those paths. |
| Missing database or collection | Confirm the database path matches Backup & restore, and copy the selected collection's actual ID. |
| No search results | Refresh the source, try fewer query words, and confirm Search works in the browser. |
| Built in test passes, assistant fails | The test uses Sift's own paths. Check the assistant's saved configuration, machine, and filesystem access. |
| Terminal appears to wait after launching mcp | Stdio waits for a protocol client. Use the assistant or Test MCP connection instead of typing into it. |

Sift uses the official MCP TypeScript SDK 1.30.0. API references: [server](https://ts.sdk.modelcontextprotocol.io/server) and [client](https://ts.sdk.modelcontextprotocol.io/client).

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
