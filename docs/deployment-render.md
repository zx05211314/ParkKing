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
- Health check: `/api/parking-answer/ready`, so deploys fail if core parking
  answer data is unavailable.

## Local Deploy Smoke

Use the deploy readiness gate to test the latest local release package without
touching the checked-in source data:

```powershell
npm run build
npm run ops:p3-release-readiness
npm run ops:deploy-readiness
```

The gate installs the latest `dist/releases` zip/manifest pair into
`.tmp/deploy-readiness/public/data/generated`, checks that built static data in
`dist/data/generated` has the same reviewed district hashes, runs reviewed pack
and parking-answer API smokes against the installed release, then starts the app
server with `PARKKING_PARKING_ANSWER_DATASET_ROOT` pointing at that installed
release. The app-server smoke also verifies `/api/parking-answer/ready` exposes
district readiness metadata with dataset hashes, so a live deploy can be checked
against the handoff package. The same command writes `.tmp/deploy-readiness.md` and
`.tmp/deploy-readiness.json`, and the release workflows upload those files with
the release package artifacts.

Generate the Render handoff after deploy readiness passes:

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

Pass the live Render service URL and the published release manifest URL. Enable
`useGithubToken` only when the manifest URL is a private GitHub Release asset
from this repository. The workflow uploads `.tmp/render-deployment-verify.md` and
`.tmp/render-deployment-verify.json` as `render-live-verify`.

This reads the release manifest dataset-hash contract, fetches
`/api/parking-answer/ready`, and fails if any reviewed district is missing, not
ready, or serving a dataset hash different from the released package. If you are
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
