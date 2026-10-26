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

The Google client ID in google-config.js is a public browser identifier, not a secret. It is restricted to the local testing origin. No OAuth client secret or access token belongs in this repository. Local development keeps its loopback-only configuration. The explicitly selected production build uses the live GitHub Pages origin. Build it with `python3 prepare-pages.py --production`; only the allowlisted runtime files are packaged.

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

The combined account flow and automatic collection selection passed 31 main-app checks at both widths, including cancellation, consent denial, account mismatch, token renewal, saves, Undo, remote updates and guest isolation. The prior two-step flow also passed a real in-app/Chrome round trip. The combined flow has also completed real Google authorization and automatically opened the existing study collection, with its original chart entries intact. Older test scripts are retained as development history and may assert superseded UI.

Personal setup notes, study backups, screenshots and logs are intentionally excluded. The development branch has no release integrity manifest: that belongs to a reviewed release build.

## Migration from multiple test workspaces

An existing file is marked with the private app property `magicPrimary=v1` after its account and journal are validated. With multiple unmarked legacy files, the app stops instead of guessing. In local testing only, an ignored `study-migration.local.json` file containing `{ "fileId": "selected-file-id" }` can identify the explicitly chosen file. This ID must match the signed-in account’s discovered files. The app marks and rechecks the selection; subsequent browsers discover the marker automatically. Other files remain untouched. Multiple primary files stop loading for review rather than risking a silent switch. Never commit a real migration file.

### Refreshing a Google session (local development)
The current tab retains its verified, short-lived Google access token in sessionStorage so refreshing can reopen the chart without another popup. Restoration checks expiration and verifies the Google account before reading its study file. It never creates a replacement file during restoration. Sign-out and cancelled restoration remove the saved connection; expired or rejected credentials require a user-initiated sign-in. Tokens are not stored in localStorage or committed to Git. This is tab-session continuity, not a permanent login or a background refresh-token flow. Pending study edits still use the existing local recovery flow.

Validation: `gjs session-refresh-browser-test.js` uses isolated synthetic Google responses to test actual reloads, restoration without a popup or data writes, sign-out, expiry, account mismatch, and malformed session data.

## Release preparation — 25 October 2026

The release includes default selection for a lone question set, a public privacy page, and a production build with a versioned dependency graph. The live OAuth client uses the same Google project as local testing so existing app-created study files remain discoverable. No broader permissions are requested. The deployment branch contains the packaged runtime; development retains tests and build helpers.

Pre-release checks: 58 synthetic main-app checks at each of 390/1280 widths, session refresh/expiry/sign-out checks, and separate sync engine recovery/conflict checks. The old two-step UI adapter assertions have been replaced by the current combined-flow checks, including narrow permission scopes and RAW spreadsheet writes.

## Studying while Google is disconnected — 26 October 2026

The app remembers the most recently opened account collection on this device, without putting Google tokens in localStorage. On reload it can reopen that cached collection before Google's SDK or account verification is available. Marks, questions and chart entries save to the account's local queue while disconnected; they remain separate from guest data. The study page shows “Saved on this device · Google sync paused” and a Reconnect Google button.

Google access still requires a valid token and verification of the same account. A cached account label is not treated as authentication. Reconnection keeps the current queue and file; normal revision/conflict protections apply. Explicit sign-out clears the automatic reopening pointers but retains underlying recovery copies. A browser/device with no previously opened collection still needs sign-in to load it. Existing users should open the updated app and sign in once to establish the remembered collection. This does not install offline website assets or provide permanent background Google access.

`gjs offline-study-browser-test.js 390` (also 1280) uses synthetic accounts and actual reloads to cover expired tokens, HTTP 401, an unavailable Google SDK, red/yellow/green marks, chart snapshots, durable pending edits, wrong-account rejection, verified reconnect, token isolation, malformed cache references and sign-out. Existing app-flow and session-refresh regression checks also pass.
