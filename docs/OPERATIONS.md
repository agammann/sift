# Upgrade, retention and recovery

## Upgrade

1. Create and verify a backup in the UI, or stop Sift and run `sift backup NEW_PATH`.
2. Stop the management service before replacing installed files. Stop/restart MCP clients when upgrading the executable.
3. Install the new local archive, run `sift version`, then `sift doctor`.
4. Start the interface and check a collection and an MCP search.

Migrations are versioned in `migrations/`. Before applying one, Sift writes a consistent `*.pre-migration-*.sqlite` backup. Migration statements run inside a transaction and roll back on failure. A database with a newer unsupported `user_version` is opened for checking only and rejected without modification. Use a compatible newer release or restore a pre-upgrade backup with the matching older release; never manually decrement `user_version`.

## Backup and restore

Backups use Node SQLite's online backup API and then SQLite integrity/foreign-key checks. An existing output path is rejected. The UI stores backups beside the database in `backups/`; the CLI accepts a new path. Copy completed backup files to another disk using ordinary file tools for protection against disk failure.

Restore requires the same supported schema. Sift copies the candidate into a staging file, validates it, creates `before-restore-TIMESTAMP.sqlite`, and imports tables transactionally into the existing database. It does not replace a live file underneath MCP readers. Errors roll back; the recovery copy remains. In-progress jobs from a backup become interrupted. Confirmation string: `REPLACE ALL DATA`.

Only restore trusted Sift backups you control. SQLite file validation is not a sandbox for arbitrary hostile databases. Never overwrite an active database or copy only its main file while WAL writes are active. Use Sift's backup command/UI.

## Retention and deletion

Current and previous successful revisions are retained by default, configurable per source up to 20. A failed refresh does not consume a successful revision slot. Confirmed 404/410 documents leave active search but keep retained revisions. An expired revision ID returns an explicit missing-content error. Change events retain their revision IDs even if the content later expires.

Source/job/outcome/change records remain until their source or collection is deleted. There is no automatic time-based pruning in 0.1.0; monitor disk usage for long-lived high-refresh workspaces. UI deletion prompts identify the affected scope and permanently delete its source content/history. Back up first if recovery is needed. Whole-workspace restore also has explicit confirmation and a recovery copy.

## Interrupted jobs

Completed page transactions survive cancellation/restart. On management startup, unfinished running jobs become `interrupted`, with a reason. They are not silently resumed and do not count as successful. Start a manual refresh to retry. Writer-lock recovery removes a stale lock only if its recorded PID no longer exists; PID reuse can conservatively block startup. In that case confirm no Sift manager is running before moving the `.writer.lock` aside.

## Troubleshooting

- **No pages:** Inspect page outcomes, robots decisions, scope paths, content type and extraction warnings. Sift cannot render JavaScript or sign in.
- **Blocked destination:** Private/local/reserved IPs and DNS mixtures are intentionally rejected. Fixtures use an injected transport in tests; there is no setting that disables the production boundary.
- **Database busy:** Let the active transaction finish. Stop the manager before CLI backup/restore/doctor. An MCP reader can remain connected. Locks have a 5-second busy timeout.
- **Disk full or permission error:** The operation does not report success. Free disk space or restore directory permissions, then run doctor and inspect the job. Atomic page/restore writes roll back. OS-level storage failures can still prevent recording the final job error; restart recovery will mark an unfinished job interrupted.
- **MCP fails to start:** Check Node 24, absolute executable paths, database path and explicit collection IDs. Stdout must remain MCP-only. Read stderr and use Connect diagnostics.
- **Empty search:** Queries are lexical AND searches. Use fewer words; remove filters; verify the source contains successful active pages.
- **Wrong version:** Labels are user supplied. Create separate sources with appropriate URL paths and labels; never relabel collected evidence as another version without recollecting.
- **Port in use:** Choose `sift start --port 4588` and visit the matching 127.0.0.1 URL. `localhost` is deliberately not an interchangeable Host alias for this service.

Scheduling stops are simple: this release has no scheduler. Collection occurs only on a manual Refresh while the management backend is running.
