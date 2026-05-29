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

Use a local release package to test the deploy data restore without touching the
checked-in source data:

```powershell
npm run ops:install-release-package -- --zip dist\releases\park-king-data_<release-id>.zip --manifest dist\releases\release_manifest_<release-id>.json --out-root .tmp\deploy-generated --require-manifest
```

Then run the app server smoke against the normal local generated data:

```powershell
npm run ops:smoke-app-server
```
