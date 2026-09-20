# Getting started with Sift

[Back to the README](../README.md)

This guide takes you from the downloadable archive to a searchable collection. Sift runs on your computer. The [public website](https://sift-docs.alx21.chatgpt.site/) hosts information and downloads.

## Before you begin

Install **Node.js 24.15 or later within Node 24** from the [official Node.js download page](https://nodejs.org/en/download). Select the 24 release line. Open a new terminal after installation, then run:

```sh
node --version
```

Expect `v24.15.0` or a newer `v24.x.x`. Other major versions are not supported by Sift 0.1.1. Windows with Node 24.19.0 has been tested. The macOS and Linux instructions have not been executed on those platforms.

## Download and verify

Download both files into the same new folder, such as a folder named `Sift` in your Documents directory:

1. [sift-local-0.1.1.tgz](https://sift-docs.alx21.chatgpt.site/downloads/sift-local-0.1.1.tgz)
2. [sift-local-0.1.1.tgz.sha256](https://sift-docs.alx21.chatgpt.site/downloads/sift-local-0.1.1.tgz.sha256)

Keep their original filenames. Open a terminal in that folder. On Windows, open the folder in File Explorer, right click an empty area, and choose **Open in Terminal**. Use a fresh folder so extraction will not overwrite another application named `package`.

In **PowerShell**, compare the download with its checksum:

```powershell
$siftExpectedHash = ((Get-Content .\sift-local-0.1.1.tgz.sha256 -Raw).Trim() -split '\s+')[0]
$siftActualHash = (Get-FileHash .\sift-local-0.1.1.tgz -Algorithm SHA256).Hash
if ($siftActualHash -ne $siftExpectedHash) { throw 'Checksum mismatch. Download the archive again.' }
'Checksum matches.'
```

On **macOS**, use:

```sh
shasum -a 256 -c sift-local-0.1.1.tgz.sha256
```

On **Linux**, use:

```sh
sha256sum -c sift-local-0.1.1.tgz.sha256
```

Expect `Checksum matches.` in PowerShell, or a result ending in `OK` on macOS/Linux. A mismatch means the file does not match the published checksum; do not continue with that copy.

## Extract and start

From the same folder:

```sh
tar -xzf sift-local-0.1.1.tgz
node package/dist/cli.js version
node package/dist/cli.js doctor
node package/dist/cli.js start
```

The archive creates a `package` folder. Keep it where you intend to run Sift, especially after configuring an assistant with its absolute path.

| Step | Expected result |
| --- | --- |
| `version` | `Sift 0.1.1` |
| `doctor` | JSON containing `"ok": true`, `"integrity": "ok"`, and the database path |
| `start` | A message containing `http://127.0.0.1:4587` and the data path |

Doctor creates the default workspace on first use. Stop any existing management process before running doctor against that same workspace. A Node SQLite experimental warning can appear; use the actual command result to determine success.

Open **http://127.0.0.1:4587**. Use that exact address, including `127.0.0.1`. Keep the terminal open while using the interface. Ctrl+C stops the management process. Closing a browser tab does not stop it.

To return later, open a terminal in the same folder and run only:

```sh
node package/dist/cli.js start
```

You do not need to extract the archive or recreate collections each time. Data lives separately from the application folder; see [data locations and backups](OPERATIONS.md#data-location).

## Try a one page collection

This uses Example Domain to check the workflow with one public page. It is a small smoke check, not a documentation quality benchmark.

1. Choose **Create your first collection** and name it `Getting started`.
2. Choose **Add source** and fill in:

| Field | Value |
| --- | --- |
| Name | `Example Domain` |
| Start URL | `https://example.com/` |
| Allowed paths | `/` |
| Version label | Leave empty |
| Max pages | `1` |
| Max depth | `0` |
| Concurrency | `1` |
| Revisions to keep | `2` |

3. Choose **Save source**, then **Refresh**. Use **Inspect** to check the result. A successful run should retain one page. If the site or network is unavailable, Inspect explains the failure.
4. Open **Search** and search for `documentation`. Open the result and inspect its source URL and retained text. Example Domain may produce a body fallback extraction warning because it is a simple page without a dedicated article element.
5. Open **Connect** and choose **Test MCP connection**. Expect a successful initialization and five discovered tools.

Next, add your actual documentation as a separate source. **Allowed paths** are path prefixes on the Start URL's exact origin: `/docs` includes `/docs/start`, but not `/documentation`. Use `/docs, /guides` for multiple prefixes. The Start URL must itself be within one of those paths. Private addresses, sign in pages, and content rendered only by JavaScript are unsupported.

Version labels describe what you know about the source; Sift does not infer versions. Search matches all query words, so begin with a short query. Refresh is manual.

## Optional: install the sift command

If Node's npm command is available, you can install the downloaded archive globally instead of using its extracted CLI:

```sh
npm install --global ./sift-local-0.1.1.tgz
sift version
sift doctor
sift start
```

Run these commands in the download folder. On Windows, use `npm.cmd` and `sift.cmd` if PowerShell blocks `.ps1` command shims. Reopen the terminal if a newly installed command is not found. If global installation is unavailable or needs permissions, use the extraction method above.

The `sift` command and extracted CLI use the same default workspace. Run only one management process for a workspace at a time. The release archive has a bundled runtime and no dependency downloads or install scripts. Do not replace the local archive path with `npm install sift`; this product is not published to the npm registry.

## Next steps

| Task | Guide |
| --- | --- |
| Give a coding assistant access to a collection | [MCP setup](MCP.md) |
| Change ports, fix startup issues, or protect your data | [Operations and troubleshooting](OPERATIONS.md) |
| Build the application from source | [Development](../CONTRIBUTING.md) |
