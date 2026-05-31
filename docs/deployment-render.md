# Render Deployment

ParkKing can run as one Node web service on Render. The service serves the built
Vite app and mounts the first-party geocoder, routing, parking-answer, and sync
APIs behind the same origin.

## Required Release Data

`public/data/generated` is intentionally ignored by Git, so a Git-based deploy
must restore a reviewed P3 release package during build.

Create and validate the package locally:

```powershell
npm run ops:p3-release-readiness
```

Or publish stable GitHub Release assets from Actions:

```text
Actions -> Release Data Package -> Run workflow
```

You can also dispatch the same workflow from this repo after previewing the
payload:

```powershell
npm run ops:release-data-dispatch -- --repo zx05211314/ParkKing --ref main --dry-run
$env:GH_TOKEN="<token with Actions workflow dispatch access>"
npm run ops:release-data-dispatch -- --repo zx05211314/ParkKing --ref main
```

That workflow fetches production sources, ingests reviewed packs, builds the UI,
runs the bundle budget, runs reviewed answer UI smokes in LIST and MAP modes,
passes P3 release readiness and deploy readiness, then publishes the package and
manifest assets.

If you need to publish the latest local `dist/releases` assets without the
Actions UI, `ops:release-data-publish` can use the GitHub REST API directly when
`GH_TOKEN` or `GITHUB_TOKEN` and `GITHUB_REPOSITORY` are set; otherwise it falls
back to the GitHub CLI:

```powershell
$env:GITHUB_REPOSITORY="zx05211314/ParkKing"
$env:GH_TOKEN="<token with contents:write>"
$env:PARKKING_RELEASE_ID="<release-id>"
$env:PARKKING_RELEASE_TAG="data-<release-id>"
$env:GITHUB_SHA="<target commit sha>"
npm run ops:release-data-publish
```

Upload both generated files from `dist/releases` to stable URLs:

- `park-king-data_<release-id>.zip`
- `release_manifest_<release-id>.json`

Do this before running another `npm run build`; `dist` is a build output and can
be cleaned by later builds.

Set these Render environment variables before deploying:

```text
PARKKING_RELEASE_PACKAGE_URL=<stable zip URL>
PARKKING_RELEASE_MANIFEST_URL=<stable manifest JSON URL>
```

For private GitHub release assets, also set one of:

```text
PARKKING_RELEASE_DOWNLOAD_TOKEN=<token with release asset read access>
PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER=<complete Authorization header>
```

The blueprint runs:

```text
npm ci && npm run ops:install-release-package -- --require-manifest && npm run build
```

The build fails if either URL is missing, if checksums do not match the manifest,
or if the installed generated data does not contain a usable registry and
district metadata. The release package is installed before `npm run build` so
Vite copies `/data/generated` into `dist` for browser-side static data reads.

## Blueprint

`render.yaml` defines a single `node` web service:

- Build command: installs dependencies, restores release data, builds the UI.
- Start command: `npm start`.
- Bind host: `0.0.0.0`.
- Node version: `NODE_VERSION=24.16.0`, matching CI and bounded by the
  `package.json` engines range.
- Health check: `/api/parking-answer/ready`, so deploys fail if core parking
  answer data is unavailable.

## Local Deploy Smoke

Use the deploy readiness gate to test the latest local release package without
touching the checked-in source data:

```powershell
npm run ops:release-handoff-readiness
```

This runner executes `npm run build`, `ops:p3-release-readiness`,
`ops:deploy-readiness`, and `ops:render-deployment-handoff` sequentially, then
checks that all gate JSON files point at the same release ID. Use it for normal
local release handoff checks; the lower-level commands are still useful when
debugging one gate at a time.

After the local handoff is ready, print the external publish/deploy status and
the exact next commands:

```powershell
npm run ops:release-handoff-status
```

This reads `.tmp/render-deployment-handoff.json` and
`.tmp/release-handoff-readiness.json`, checks whether the expected GitHub
Release tag is already published, and prints the dry-run/dispatch commands for
`Release Data Package` and `Render Live Verify`. Pass `--app-url` or set
`PARKKING_RENDER_APP_URL` to render the final live verification command with a
real Render service URL.

The deploy readiness gate installs the latest `dist/releases` zip/manifest pair into
`.tmp/deploy-readiness/public/data/generated`, checks that built static data in
`dist/data/generated` has the same reviewed district hashes, runs reviewed pack
and parking-answer API smokes against the installed release, then starts the app
server with `PARKKING_PARKING_ANSWER_DATASET_ROOT` pointing at that installed
release. The app-server smoke verifies `/api/parking-answer/ready` exposes
district readiness metadata with dataset hashes, probes the mounted same-origin
geocode, route, sync, and parking-answer health/ready endpoints, and runs a sync
issue-report roundtrip before the app server is accepted. The same command writes
`.tmp/deploy-readiness.md` and `.tmp/deploy-readiness.json`, and the release
workflows upload those files with the release package artifacts.

If you are running gates manually, generate the Render handoff after deploy
readiness passes:

```powershell
npm run ops:render-deployment-handoff
```

This writes `.tmp/render-deployment-handoff.md` and
`.tmp/render-deployment-handoff.json` with the expected GitHub Release asset
URLs and exact `PARKKING_RELEASE_PACKAGE_URL` /
`PARKKING_RELEASE_MANIFEST_URL` values. The JSON and markdown also include the
expected per-district dataset hashes that the live Render service must expose
from `/api/parking-answer/ready`. Those URLs become live after the `Release Data
Package` workflow publishes the same release ID. If you run the workflow later
and let it generate a fresh release ID, use the URLs printed by that workflow
summary or its uploaded handoff artifact instead of the earlier local preview.

After publishing GitHub Release assets, verify the URLs before assigning them to
Render:

```powershell
npm run ops:release-data-url-smoke
```

The release workflow runs this automatically after `ops:release-data-publish`.
It checks the package URL with `HEAD`, fetches the manifest URL, and verifies the
manifest `releaseId` matches the released package.

After Render finishes deploying those release URLs, verify the live service
against the handoff contract:

```powershell
npm run ops:render-deployment-verify -- --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL>
```

The same check can run from GitHub Actions:

```text
Actions -> Render Live Verify -> Run workflow
```

Or dispatch that workflow from this repo after previewing the exact payload:

```powershell
npm run ops:render-live-verify-dispatch -- --app-url https://<service>.onrender.com --dry-run
$env:GH_TOKEN="<token with Actions workflow dispatch access>"
npm run ops:render-live-verify-dispatch -- --app-url https://<service>.onrender.com
```

By default this command reads the manifest URL from
`.tmp/render-deployment-handoff.json`; pass `--manifest-url` to verify a
different published release.

Pass the live Render service URL and the published release manifest URL. Enable
`useGithubToken` only when the manifest URL is a private GitHub Release asset
from this repository. Leave `skipSyncIssueRoundtrip` false unless the live
environment intentionally rejects sync smoke writes; dataset hash checks and
health/ready probes still run when only the roundtrip is skipped. The workflow
uploads `.tmp/render-deployment-verify.md` and `.tmp/render-deployment-verify.json`
as `render-live-verify`.

The `Release Data Package` workflow summary also prints
`VERIFY_RENDER_DEPLOY_WORKFLOW_INPUTS`; keep `skipSyncIssueRoundtrip=false` and
choose `useGithubToken=true` for private release assets or `false` for public
release assets.

This reads the release manifest dataset-hash contract, fetches
`/api/parking-answer/ready`, and fails if any reviewed district is missing, not
ready, or serving a dataset hash different from the released package. It also
probes the live same-origin geocode, route, sync, and parking-answer
health/ready endpoints and runs a sync issue-report roundtrip. If you are
verifying from the same machine that generated the handoff, the command can use
`.tmp/render-deployment-handoff.json` instead of `--manifest-url`.

Validate the checked-in Blueprint contract before relying on a deploy:

```powershell
npm run ops:render-blueprint-check
```

This fails if `render.yaml` no longer installs the release package before
building, no longer uses `/api/parking-answer/ready` as the health check, or
loses required same-origin API / release-data environment variables. CI,
publish, and release-data workflows run this gate automatically.

Run `ops:p3-release-readiness` after `npm run build` because Vite cleans `dist`
before building and would otherwise remove `dist/releases`.

For lower-level debugging, install a specific release package into an isolated
folder:

```powershell
npm run ops:install-release-package -- --zip dist\releases\park-king-data_<release-id>.zip --manifest dist\releases\release_manifest_<release-id>.json --out-root .tmp\deploy-generated --require-manifest
```
