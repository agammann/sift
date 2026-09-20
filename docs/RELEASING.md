# Repeatable local release procedure

Use a clean source checkout, Node 24.15 or later within Node 24, and pnpm 11.19.0. Start with the [development guide](../CONTRIBUTING.md). Run all commands from the repository root.

1. Update the package version and the version constant in `src/model.ts`; update the changelog and current download links in README and Getting started. The UI displays the backend's version. Keep historical verification reports and old artifact checksums unchanged.
2. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm run build` and `pnpm test`.
4. Run `node scripts/notices.mjs` to collect license declarations/text from the installed exact dependency tree; review notices.
5. Run `pnpm run release`. This creates `artifacts/sift-local-VERSION.tgz` and a SHA-256 file. The backend, UI, migration, docs, examples and notices are included. Runtime npm dependencies/install scripts are omitted because the runtime is bundled.
6. Run `pnpm run verify:package`. It installs the archive for the current package version in a fresh temporary project with scripts disabled, then checks version, doctor, the interface, a management mutation, and a real stdio MCP connection. Also extract the archive into a fresh folder and try the README path. Verify the checksum and archive contents before distribution.
7. Update the verification report with actual platform and test evidence. Review `git diff`, scan tracked files for data/secrets, commit the lockfile, and tag the verified commit.

The lockfile pins the dependency graph; bit-for-bit build or archive reproducibility is not promised. Checksums apply to the produced artifact, not future rebuilds. Keep a published version's archive immutable and use a new patch version for executable changes.

No script publishes to npm, GitHub Releases, a web host or a paid service. Public source is maintained on GitHub and downloadable archives are served by the companion website. Publishing updated downloads is a separate step: upload the verified archive and matching checksum, update website links, and confirm the downloaded bytes match the local artifact. Preserve old download URLs. License selection and cross-platform validation remain explicit decisions.
