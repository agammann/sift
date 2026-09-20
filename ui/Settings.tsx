import { useState } from "react";
import { api, download } from "./api.js";
import { Button, Field } from "./components.js";
export function Connect({
  cid,
  act,
  launch,
}: {
  cid: string;
  act: (f: () => Promise<any>) => Promise<void>;
  launch: { command: string; args: string[] };
}) {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const config = {
    mcpServers: {
      sift: {
        command: launch.command,
        args: [...launch.args, "--collections", cid],
      },
    },
  };
  return (
    <>
      <h2>Connect your coding assistant</h2>
      <p>
        Five read-only tools. Only this collection is exposed by the
        configuration below.
      </p>
      <section className="panel">
        <h3>Local stdio configuration</h3>
        <p>
          Add this server to your assistant’s local MCP settings. These absolute
          paths use the running Sift installation and this workspace, including
          when you extracted the archive without installing a global command.
        </p>
        <pre>{JSON.stringify(config, null, 2)}</pre>
        <Button
          onClick={() =>
            void act(() =>
              navigator.clipboard.writeText(JSON.stringify(config, null, 2)),
            )
          }
        >
          Copy configuration
        </Button>
        <p className="footnote">
          This configuration is for an assistant running on this computer. After
          moving or upgrading Sift or Node, copy it again. See the MCP guide for
          Codex TOML and other clients.
        </p>
      </section>
      <section className="panel">
        <h3>Connection diagnostics</h3>
        <p>
          Starts a real child-process MCP connection against this workspace,
          initializes the protocol and discovers its tools.
        </p>
        <Button
          onClick={() =>
            void act(async () =>
              setDiagnostics(
                await api(`/collections/${cid}/diagnostics`, "POST", {}),
              ),
            )
          }
        >
          Test MCP connection
        </Button>
        {diagnostics && <pre>{JSON.stringify(diagnostics, null, 2)}</pre>}
      </section>
      <section className="panel">
        <h3>Sift collection profile</h3>
        <p>
          A versioned Sift format describing source URLs, scope, labels and
          crawl settings. It contains no document bodies and is not a universal
          MCP configuration format.
        </p>
        <Button
          onClick={() =>
            void act(async () =>
              download(
                `sift-collection-${cid}.json`,
                await api(`/collections/${cid}/profile`),
              ),
            )
          }
        >
          Export profile
        </Button>
      </section>
    </>
  );
}
export function Workspace({
  health,
  act,
  reload,
}: {
  health: any;
  act: (f: () => Promise<any>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [backup, setBackup] = useState<any>(null),
    [restored, setRestored] = useState<any>(null);
  return (
    <>
      <h1>Backup & restore</h1>
      <p>
        Protect the entire local workspace, including all collections and
        retained revisions.
      </p>
      <section className="panel">
        <h2>Local workspace</h2>
        <p>
          SQLite schema {health?.schema} · Integrity: {health?.integrity}
        </p>
        <code className="path">{health?.database}</code>
        <p>
          Telemetry is not collected. The management service is bound to
          127.0.0.1.
        </p>
      </section>
      <section className="panel">
        <h2>Create a consistent backup</h2>
        <p>
          SQLite’s online backup API produces a consistent snapshot, even while
          readers are connected. The completed backup is checked before success
          is reported.
        </p>
        <Button
          primary
          onClick={() =>
            void act(async () => setBackup(await api("/backup", "POST", {})))
          }
        >
          Create backup
        </Button>
        {backup && (
          <p role="status">
            Backup verified: <code className="path">{backup.path}</code>
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Restore a backup</h2>
        <p>
          This replaces all collections and content. Cancel active crawls first.
          Sift validates the backup and saves a recovery copy before the
          transaction.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void act(async () => {
              setRestored(
                await api("/restore", "POST", {
                  path: d.get("path"),
                  confirm: d.get("confirm"),
                }),
              );
              await reload();
            });
          }}
        >
          <Field label="Backup file path">
            <input
              name="path"
              required
              placeholder="Absolute path to a Sift .sqlite backup"
            />
          </Field>
          <Field label="Type REPLACE ALL DATA">
            <input
              name="confirm"
              required
              pattern="REPLACE ALL DATA"
              autoComplete="off"
            />
          </Field>
          <Button type="submit">Validate and restore</Button>
        </form>
        {restored && (
          <p role="status">
            Restored. Recovery copy:{" "}
            <code className="path">{restored.recovery_backup}</code>
          </p>
        )}
      </section>
    </>
  );
}
