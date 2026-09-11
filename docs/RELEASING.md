# Repeatable local release procedure

Use a clean source checkout, Node 24 and pnpm 11.19.0.

1. Update the package version and the version constant in `src/model.ts`; update the UI version label and changelog.
2. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm run build` and `pnpm test`.
4. Run `node scripts/notices.mjs` to collect license declarations/text from the installed exact dependency tree; review notices.
5. Run `pnpm run release`. This creates `artifacts/sift-local-VERSION.tgz` and a SHA-256 file. The backend, UI, migration, docs, examples and notices are included. Runtime npm dependencies/install scripts are omitted because the runtime is bundled.
6. Install the archive in a fresh directory with `pnpm add /absolute/path/to/archive.tgz --ignore-scripts`, then run the installed `sift`/direct Node CLI, doctor, start, and an MCP client. Verify archive contents before distribution.
7. Update the verification report with actual platform and test evidence. Review `git diff`, scan tracked files for data/secrets, commit the lockfile, and tag the verified commit.

Build output is reproducible from the lockfile; archive byte-for-byte reproducibility is not promised because tar metadata and gzip timestamps may vary. Checksums apply to the produced artifact, not future rebuilds.

No script publishes to npm, GitHub Releases, a web host or a paid service. Public source repository creation/push is a separate owner-authorized action. Ownership, license selection, public release publication and cross-platform release validation remain explicit decisions.
