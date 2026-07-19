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

If local tokens and the Actions UI are unavailable, the same workflow also runs
on pushed `data-*` tags. For a prepared local handoff, push the exact release tag
shown by `ops:release-handoff-status`; the workflow derives
`PARKKING_RELEASE_ID_INPUT` from `data-<release-id>` so the published
zip/manifest filenames match the handoff URLs:

```powershell
git tag data-<release-id> main
git push origin data-<release-id>
```

That workflow fetches production sources, ingests reviewed packs, builds the UI,
runs the bundle budget, runs reviewed answer UI smokes in LIST and MAP modes,
passes P3 release readiness and deploy readiness, then publishes the package and
manifest assets.
Tag-triggered releases set `allowWarn=true`, enable reviewed baseline adoption,
allow reviewed answer-case hash drift after the workflow re-ingests production
sources, and include an explicit reviewed-release override reason for the ingest
publish gate, because the tag path has no manual workflow inputs. The reviewed
cases still validate answer kind, evidence, confidence, and UI text; hard data
failures still block the release, and the later reviewed UI, P3,
deploy-readiness, publish, and URL-smoke gates must still pass.

`data-*` tags are workflow-managed. Do not manually create a GitHub Release or
upload local assets to one of these tags: creating the tag starts Release Data
Package, which re-ingests current sources and may replace any assets uploaded
before it finishes. The completed workflow artifact, published manifest, and
per-district dataset identities (`datasetHash` plus `publishedAt`) are
authoritative.

For a custom tag that does not match `data-*`, `ops:release-data-publish` can use
the GitHub REST API directly when `GH_TOKEN` or `GITHUB_TOKEN` and
`GITHUB_REPOSITORY` are set; otherwise it falls back to the GitHub CLI:

```powershell
$env:GITHUB_REPOSITORY="zx05211314/ParkKing"
$env:GH_TOKEN="<token with contents:write>"
$env:PARKKING_RELEASE_ID="<release-id>"
$env:PARKKING_RELEASE_TAG="manual-<release-id>"
$env:GITHUB_SHA="<target commit sha>"
npm run ops:release-data-publish
```

The handoff wrapper reads `.tmp/render-deployment-handoff.json`, checks the
release ID suffix against `git rev-parse <ref>`, and identifies the copied
handoff zip/manifest pair. It blocks workflow-managed `data-*` tags by default.
The override is only for emergency recovery after the tag-triggered workflow has
been deliberately disabled:

```powershell
$env:GH_TOKEN="<token with contents:write>"
npm run ops:release-data-publish-handoff -- --ref main --dry-run
npm run ops:release-data-publish-handoff -- --ref main --allow-workflow-managed-tag
```

The lower-level `ops:release-data-publish` command applies the same local guard.
Its emergency override is
`PARKKING_ALLOW_WORKFLOW_MANAGED_TAG_PUBLISH=true`; GitHub Actions is allowed to
publish these tags without an override.

The handoff JSON points at copied assets under
`.tmp/release-handoff-assets/<release-id>/`, so the wrapper can still publish
the exact handoff pair after another Vite build clears `dist/releases`.

Upload both handoff files to stable URLs:

- `park-king-data_<release-id>.zip`
- `release_manifest_<release-id>.json`

If you bypass the handoff wrapper and upload directly from `dist/releases`, do
that before running another `npm run build`; `dist` is a build output and can be
cleaned by later builds.

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
npm ci --include=dev && npm run ops:install-release-package -- --require-manifest && npm run build
```

`--include=dev` is required because Render builds with `NODE_ENV=production`,
while the release installer and frontend build use build-time dependencies such
as `fast-glob`, TypeScript, and Vite.

The build fails if either URL is missing, if checksums do not match the manifest,
or if the installed generated data does not contain a usable registry and
district metadata. The release package is installed before `npm run build` so
Vite copies `/data/generated` into `dist` for browser-side static data reads.

## Blueprint

`render.yaml` defines a single `node` web service:

- Build command: installs dependencies, restores release data, builds the UI.
- Start command: `npm start` (runs the prebuilt `dist-server/appServer.cjs`).
- Bind host: `0.0.0.0`.
- Node version: `NODE_VERSION=24.16.0`, matching CI and bounded by the
  `package.json` engines range.
- Health check: `/api/parking-answer/ready`, so deploys fail if core parking
  answer data is unavailable or the bundled spatial index cannot initialize.
  Spatial runtime failures are reported in `invalidFiles` with the
  `runtime/spatial-index` prefix.
- Sync CORS: `PARKKING_SYNC_CORS_ORIGINS` is set to the deployed app origin
  (`https://parkking.onrender.com` in the checked-in blueprint). Update it to
  the exact Render/custom-domain origin before deploying a different public
  host; do not use `*` for production because sync exposes write endpoints.
- Upstream proxy timeouts: `PARKKING_GEOCODER_REQUEST_TIMEOUT_MS=5000` and
  `PARKKING_ROUTING_REQUEST_TIMEOUT_MS=8000` bound each public-provider request
  before retry/fallback, so a slow Nominatim/OSRM response cannot hold the
  same-origin API indefinitely.

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
`.tmp/release-handoff-readiness.json`, checks that copied local release assets
still exist, checks whether the expected GitHub Release tag is already
published, and prints the dry-run/dispatch commands for `Release Data Package`
and `Render Live Verify`, plus the `git tag ...; git push origin ...` fallback
that publishes the same release ID through the tag-triggered release workflow.
Pass `--app-url` or set `PARKKING_RENDER_APP_URL` to render the final live
verification command with a real Render service URL.

When credentials are not available in the local environment, generate a single
handoff request for the human/operator who will publish the release and deploy
Render:

```powershell
npm run ops:release-publish-request -- --ref main --app-url https://<service>.onrender.com
```

This writes `.tmp/release-publish-request.md` and
`.tmp/release-publish-request.json` with the target SHA, exact local
zip/manifest paths, asset byte counts and SHA-256 checksums, token/CLI
availability, a manual GitHub UI release-publish checklist, exact publish
commands, Render environment variables, Render env sync
service-id/service-name/workflow commands, and final verification commands. It
does not publish assets or call Render.

For a single operator-facing rollout decision report, run:

```powershell
npm run ops:production-rollout-status -- --ref main --app-url https://<service>.onrender.com
npm run ops:production-rollout-status -- --ref main --app-url https://<service>.onrender.com --check-live
npm run ops:production-rollout-status -- --ref main --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL> --check-live
```

The first command reports release/handoff readiness, local credential
availability, Render env sync commands, and the next action without touching the
live service. `--check-live` also runs Render deployment verification and changes
the state from `READY_FOR_LIVE_VERIFY` to either `LIVE_VERIFIED` or
`NEEDS_RENDER_ENV_SYNC`. Add `--require-live-pass` only in gates that should
fail unless production already matches the release package and runtime hardening
checks. In environments that do not have `.tmp/render-deployment-handoff.json`,
pass `--manifest-url`; the package URL is inferred for standard release asset
filenames, or can be supplied explicitly with `--package-url`. The same report
is available as the manual GitHub Actions workflow `Production Rollout Status`,
or can be dispatched from a tokenized CLI:

```powershell
npm run ops:production-rollout-status-dispatch -- --repo <owner/repo> --ref main --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL> --dry-run
$env:GH_TOKEN="<token with workflow dispatch access>"
npm run ops:production-rollout-status-dispatch -- --repo <owner/repo> --ref main --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL>
```

The deploy readiness gate installs the latest `dist/releases` zip/manifest pair into
`.tmp/deploy-readiness/public/data/generated`, checks that built static data in
`dist/data/generated` has the same reviewed district hashes, runs reviewed pack
and parking-answer API smokes against the installed release, then starts the app
server with `PARKKING_PARKING_ANSWER_DATASET_ROOT` pointing at that installed
release. The app-server smoke verifies `/api/parking-answer/ready` exposes
district readiness metadata with dataset identities, probes the mounted same-origin
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
URLs and exact Render env values, including `PARKKING_RELEASE_PACKAGE_URL`,
`PARKKING_RELEASE_MANIFEST_URL`, `PARKKING_SYNC_CORS_ORIGINS`,
`PARKKING_GEOCODER_REQUEST_TIMEOUT_MS`, and
`PARKKING_ROUTING_REQUEST_TIMEOUT_MS`. The handoff also copies the local
zip/manifest into `.tmp/release-handoff-assets/<release-id>/` and stores those
copied paths in `releaseAssetPaths` for local publishing. The JSON and markdown
also include the expected per-district dataset identity (`datasetHash` and
`publishedAt`) that the live Render service must expose from
`/api/parking-answer/ready`. The release manifest is authoritative for those
values. Those URLs become live after the `Release Data Package` workflow
publishes the same release ID. If you run the workflow later and let it generate
a fresh release ID, use the URLs printed by that workflow summary or its
uploaded handoff artifact instead of the earlier local preview.

After publishing GitHub Release assets, verify the URLs before assigning them to
Render:

```powershell
npm run ops:release-data-url-smoke
```

The release workflow runs this automatically after `ops:release-data-publish`.
It checks the package URL with `HEAD`, falls back to `GET` with
`Range: bytes=0-0` when `HEAD` is rejected, fetches the manifest URL, and
verifies the manifest `releaseId` matches the released package. It also rejects
incomplete or duplicate per-district `datasetHash` plus `publishedAt`
identities.

After Render finishes deploying those release URLs, verify the live service
against the handoff contract:

```powershell
npm run ops:render-deployment-verify -- --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL>
```

The verifier requires an explicit `--manifest-url`, `--manifest`, or
`--handoff-json` contract source. It never selects a local handoff implicitly,
which prevents an old `.tmp/render-deployment-handoff.json` from being mistaken
for the deployed release.

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
different published release. Non-dry-run dispatches first fetch and parse the
manifest, so an unpublished or invalid handoff is rejected before a GitHub
Actions run is created.

Pass the live Render service URL and the published release manifest URL. Enable
`useGithubToken` only when the manifest URL is a private GitHub Release asset
from this repository. Leave `skipSyncIssueRoundtrip` false unless the live
environment intentionally rejects sync smoke writes; dataset identity checks and
health/ready probes still run when only the roundtrip is skipped. The workflow
also runs the live Taoyuan paid-curb source-to-map UI smoke after the API and
dataset contract passes. It uploads `.tmp/render-deployment-verify.md` and
`.tmp/render-deployment-verify.json` as `render-live-verify`.

The `Release Data Package` workflow summary also prints
`VERIFY_RENDER_DEPLOY_WORKFLOW_INPUTS`; keep `skipSyncIssueRoundtrip=false` and
choose `useGithubToken=true` for private release assets or `false` for public
release assets.

This reads the release manifest dataset identity contract, fetches
`/api/parking-answer/ready`, and fails if any reviewed district is missing, not
ready, or serving a `datasetHash` or `publishedAt` different from the released
package. Requiring `publishedAt` prevents unchanged content hashes from allowing
an older Render deployment to pass as the new release. The readiness probe uses
a 30-second per-attempt timeout and three transient attempts by default so a
Render Free cold start does not produce a false release failure; other requests
retain the 15-second timeout. Use `--readiness-timeout-ms` and `--timeout-ms` to
override those budgets independently. It also
probes the live same-origin geocode, route, sync, and parking-answer
health/ready endpoints, verifies geocoder/routing readiness exposes positive
upstream request timeouts, runs a sync issue-report roundtrip, and verifies sync
CORS rejects an untrusted browser origin instead of returning wildcard access.
When live dataset identities differ from the release contract, the generated
markdown and JSON reports include a release-package remediation block with the
exact Render `PARKKING_RELEASE_PACKAGE_URL` and
`PARKKING_RELEASE_MANIFEST_URL` values, full build/redeploy steps, and the
follow-up verification command. This is the signal that Render is likely serving
fallback `public/data/generated`, a stale release package, or an old build.
When sync CORS or proxy timeout checks fail, the generated markdown and JSON
reports include a runtime remediation block with the exact Render env vars,
redeploy steps, and follow-up verify command.
If you know the Render service ID, you can preview the runtime and release env
plan from the CLI without a Render token:

```powershell
npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>"
npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --handoff-json .tmp/render-deployment-handoff.json
```

Set a Render API key only when you are ready to apply the env vars and deploy:

```powershell
$env:RENDER_API_KEY="<Render API key>"
npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --execute --deploy
npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --handoff-json .tmp/render-deployment-handoff.json --execute --deploy
```

If no Render API key or service ID is available, generate the same values as a
dashboard-ready packet:

```powershell
npm run ops:render-dashboard-env-packet -- --app-url https://<service>.onrender.com
npm run ops:render-dashboard-env-packet -- --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL> --package-url <PARKKING_RELEASE_PACKAGE_URL>
```

The packet writes `.tmp/render-dashboard-env-packet.md` and
`.tmp/render-dashboard-env-packet.json` with exact key/value rows, a PowerShell
export preview, a manual deploy checklist, and the follow-up live verification
commands. It defaults to `.tmp/production-rollout-handoff.json` when present,
then `.tmp/render-deployment-handoff.json`. The manual `Production Rollout
Status` GitHub Actions workflow builds and uploads the same dashboard packet
artifact after generating `.tmp/production-rollout-handoff.json`.

The sync command updates `PARKKING_SYNC_CORS_ORIGINS`,
`PARKKING_GEOCODER_REQUEST_TIMEOUT_MS`, and
`PARKKING_ROUTING_REQUEST_TIMEOUT_MS` directly on the service, then triggers a
Render deploy when `--deploy` is present. Add `--handoff-json
.tmp/render-deployment-handoff.json` to also sync
`PARKKING_RELEASE_PACKAGE_URL` and `PARKKING_RELEASE_MANIFEST_URL` from the
reviewed release handoff, or pass `--package-url` and `--manifest-url`
explicitly. Use `--service-name parkking` only when `RENDER_API_KEY` is set and
you need the tool to resolve the service ID through the Render API. The same
operation is available from GitHub Actions -> Render Runtime Env Sync when the
repository has a `RENDER_API_KEY` secret. The workflow is dry-run by default;
set `execute=true` only when you are ready to change Render. To
dispatch that workflow from a tokenized CLI instead of the Actions UI:

After a successful `Release Data Package` run from the repository default
branch or a `data-*` tag, the same Render Runtime Env Sync workflow runs the
production rollout automatically. It downloads the exact upstream
`release-data-package` artifact and reads
`.tmp/render-deployment-handoff.json` rather than inferring a release from the
branch name. It then syncs the release/runtime env vars with
`--execute --deploy`, triggers a full Render deploy, and runs:

1. `ops:wait-render-release` until all 12 live dataset hashes and publication timestamps match the handoff.
2. `ops:render-deployment-verify --all-parking-answer-cases`.
3. The live smoke for every published Taoyuan paid-curb reference UI.
4. GitHub Latest promotion for the verified data release.

Any failed step leaves the previous Latest release unchanged and uploads the
sync, wait, and live-verify reports. For the least fragile automatic path,
configure both repository secrets:

- `RENDER_API_KEY`: Render API token used to update env vars and trigger deploys.
- `PARKKING_RENDER_SERVICE_ID`: Render service id, for example `srv-...`, so the workflow does not need to resolve the `parkking` service by name.

`PARKKING_RENDER_SERVICE_NAME` is optional and only needed when intentionally
using a non-default Render service name. Set the optional
`PARKKING_RENDER_APP_URL` repository variable when production is not
`https://parkking.onrender.com`. If `RENDER_API_KEY` is not configured as a
repository secret, the release still remains published, but the automatic
rollout fails before Latest promotion and the dashboard packet remains the
manual fallback.

```powershell
npm run ops:render-runtime-env-sync-dispatch -- --repo <owner/repo> --ref main --handoff-json .tmp/render-deployment-handoff.json --dry-run
$env:GH_TOKEN="<token with workflow dispatch access>"
npm run ops:render-runtime-env-sync-dispatch -- --repo <owner/repo> --ref main --handoff-json .tmp/render-deployment-handoff.json --execute
```

If you are
verifying from the same machine that generated the handoff, the command can use
`--handoff-json .tmp/render-deployment-handoff.json` instead of
`--manifest-url`.

Validate the checked-in Blueprint contract before relying on a deploy:

```powershell
npm run ops:render-blueprint-check
```

This fails if `render.yaml` no longer installs the release package before
building, no longer uses `/api/parking-answer/ready` as the health check, loses
required same-origin API / release-data environment variables, or leaves sync
CORS open to `*`. It also verifies production geocoder/routing upstream request
timeouts stay explicitly configured. CI, publish, and release-data workflows run
this gate automatically.

Run `ops:p3-release-readiness` after `npm run build` because Vite cleans `dist`
before building and would otherwise remove `dist/releases`.

For lower-level debugging, install a specific release package into an isolated
folder:

```powershell
npm run ops:install-release-package -- --zip dist\releases\park-king-data_<release-id>.zip --manifest dist\releases\release_manifest_<release-id>.json --out-root .tmp\deploy-generated --require-manifest
```
