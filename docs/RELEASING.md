# Repeatable local release procedure

Use a clean source checkout, Node 24.15 or later within Node 24, and pnpm 11.19.0. Start with the [development guide](../CONTRIBUTING.md). Run all commands from the repository root.

1. Update the package version and the version constant in `src/model.ts`; update the changelog and current download links in README and Getting started. The UI displays the backend's version. Keep historical verification reports and old artifact checksums unchanged.
2. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm run build` and `pnpm test`.
4. Run `pnpm run notices` to collect license declarations/text from the installed exact dependency graph; review notices. Old package versions left in pnpm's store are excluded.
5. Run `pnpm run release`. This creates `artifacts/sift-local-VERSION.tgz` and a SHA-256 file. The backend, UI, migration, docs, examples and notices are included. Runtime npm dependencies/install scripts are omitted because the runtime is bundled.
6. Run `pnpm run verify:package`. It installs the archive for the current package version in a fresh temporary project with scripts disabled, then checks version, doctor, the interface, a management mutation, and a real stdio MCP connection. Also extract the archive into a fresh folder and try the README path. Verify the checksum and archive contents before distribution.
7. Update the verification report with actual platform and test evidence. Review `git diff`, scan tracked files for data/secrets, commit the lockfile, and open a reviewed pull request. The main release workflow creates the exact checked tag; do not move an existing published tag.

The lockfile pins the dependency graph; bit-for-bit build or archive reproducibility is not promised. Checksums apply to the produced artifact, not future rebuilds. Keep a published version's archive immutable and use a new patch version for executable changes.

The repository workflow verifies source installation, build, tests, audit and packaging on three platforms. It then installs the same Linux-produced archive on Windows, Ubuntu and macOS. Only a main push whose checks all pass may publish: the job downloads those exact assets, validates archive and combined checksums, uploads a complete draft, checks uploaded digests, creates the tag at the verified commit, and publishes last. Write permission is confined to that job. Manual/PR checks do not publish. Existing published versions stay unchanged; a failed draft may be retried only for the same commit. No script publishes to npm, a web host or a paid service.

After publication, verify the release tag and asset digests, download the released archive into a fresh folder, and run the documented checksum/extraction workflow. The companion website’s older downloads remain intact; updating its download links is a separate hosted change. Sift’s own code is MIT licensed and the bundled dependency notices must be preserved.
