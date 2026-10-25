# Magic Spreadsheet

A study chart with question sets, recall ratings, and progress snapshots. Inspired by Ali Abdaal’s study techniques; independent and not officially affiliated.

## Branches and publication

- `main`: approved live version, published by GitHub Pages from the repository root.
- `development`: work in progress. Pushing here does not publish the site.

Do not merge to main, change Pages settings, or deploy without explicit approval. This branch begins with one honest checkpoint of previously uncommitted work; it does not reconstruct historical editing steps.

## Local development

Static HTML, CSS and ES modules; no build dependencies. Serve this folder with:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Use http://127.0.0.1:8765/ for the configured local Google testing client. If that port is already running, confirm its source directory before starting another server. Browser data belongs to the origin; do not change the port or hostname to access existing guest records.

The Google client ID in google-config.js is a public browser identifier, not a secret. It is restricted to the local testing origin. No OAuth client secret or access token belongs in this repository. Production OAuth setup remains separate; prepare-pages.py deliberately refuses packaging with the local client configured.

## Data behavior

Guest data saves in this browser and stays separate from Google account data. The Sign in with Google button starts account selection and app-specific spreadsheet consent together. One study collection opens automatically after authorization. New accounts receive a study spreadsheet automatically. Existing accounts reuse the primary study file; the app never merges or deletes older test files. Signing in does not upload guest records.

Account edits save locally first, then to an append-only Google Sheets Journal. Saves are confirmed by exact read-back. Conflicts retain copies and require an explicit choice. Offline edits remain local; reconnecting renews temporary in-memory access. Sign out returns to guest data. Do not edit the Journal manually.

## Validation

Tests use synthetic records in isolated WebKit contexts (GJS, GTK 3 and WebKit2 4.0 required). With this source served on the local origin:

```sh
gjs sync-app-browser-test.js 390
gjs sync-app-browser-test.js 1280
gjs sync-browser-test.js
```

The combined account flow and automatic collection selection are covered by the main-app checks at both widths, including cancellation, consent denial, account mismatch, token renewal, saves, Undo, remote updates and guest isolation. The prior two-step flow also passed a real in-app/Chrome round trip. A real Google consent round trip for the newer combined flow remains outstanding. Older test scripts are retained as development history and may assert superseded UI.

Personal setup notes, study backups, screenshots and logs are intentionally excluded. The development branch has no release integrity manifest: that belongs to a reviewed release build.

## Migration from multiple test workspaces

An existing file is marked with the private app property `magicPrimary=v1` after its account and journal are validated. With multiple unmarked legacy files, the app stops instead of guessing. In local testing only, an ignored `study-migration.local.json` file containing `{ "fileId": "selected-file-id" }` can identify the explicitly chosen file. This ID must match the signed-in account’s discovered files. The app marks and rechecks the selection; subsequent browsers discover the marker automatically. Other files remain untouched. Multiple primary files stop loading for review rather than risking a silent switch. Never commit a real migration file.
