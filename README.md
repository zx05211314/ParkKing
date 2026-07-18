# Park King

Reviewed curb-parking intelligence app. The ingest pipeline builds district datasets and publishes packs for the app.

## Quickstart

- Runtime: Node `>=22.12` (`.node-version` pins local/default workflow parity to Node 24)
- Install: `npm ci`
- Dev: `npm run dev`
- Tests: `npm test`
- Build: `npm run build`
- Production-style local server: `npm run build && npm start`

## Map, Geocoder, And Routing Providers

Runtime map and address search providers are configured with Vite env vars, usually in
`.env.local`. Start from `.env.example` when setting up a new clone.

Example:

```bash
VITE_MAP_STYLE_URL=
VITE_MAP_RASTER_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=&copy; OpenStreetMap contributors
VITE_MAP_RASTER_MAX_ZOOM=19
VITE_MAP_RASTER_TILE_SIZE=256

VITE_GEOCODER_URL=/api/geocode
VITE_GEOCODER_FALLBACK_URL=
VITE_GEOCODER_LIMIT=5
VITE_GEOCODER_COUNTRY_CODES=tw

VITE_ROUTING_URL=/api/route
VITE_ROUTING_FALLBACK_URL=
VITE_PARKING_ANSWER_URL=
VITE_SYNC_BASE_URL=
VITE_SYNC_BOOTSTRAP_PATH=bootstrap
VITE_SYNC_STATUS_PATH=status
VITE_SYNC_READINESS_PATH=ready
VITE_SYNC_SAVED_PLANS_PATH=saved-plans
VITE_SYNC_REPORTS_PATH=reports
VITE_SYNC_ISSUES_PATH=issues
VITE_SYNC_SCOPE=
VITE_SAVED_PLANS_URL=
VITE_REPORTS_URL=
VITE_ISSUE_REPORTS_URL=

PARKKING_GEOCODER_PRIMARY_URL=https://nominatim.openstreetmap.org/search
PARKKING_GEOCODER_FALLBACK_URL=
PARKKING_GEOCODER_COUNTRY_CODES=tw
PARKKING_GEOCODER_LIMIT=5
PARKKING_GEOCODER_CACHE_TTL_MS=21600000
PARKKING_GEOCODER_REQUEST_TIMEOUT_MS=5000
PARKKING_GEOCODER_CACHE_FILE=.tmp/geocoder-cache.json
PARKKING_GEOCODER_USER_AGENT=ParkKing/1.0 (+local-dev)
PARKKING_GEOCODER_PORT=8787
PARKKING_GEOCODER_PATH=/api/geocode

PARKKING_ROUTING_PRIMARY_URL=https://router.project-osrm.org
PARKKING_ROUTING_FALLBACK_URL=
PARKKING_ROUTING_CACHE_TTL_MS=1800000
PARKKING_ROUTING_REQUEST_TIMEOUT_MS=8000
PARKKING_ROUTING_CACHE_FILE=.tmp/route-cache.json
PARKKING_ROUTING_USER_AGENT=ParkKing/1.0 (+local-dev)
PARKKING_ROUTING_PORT=8788
PARKKING_ROUTING_PATH=/api/route

PORT=4173
PARKKING_APP_PORT=
PARKKING_APP_HOST=
PARKKING_APP_STATIC_DIR=dist
PARKKING_APP_SPA_FALLBACK=true
PARKKING_APP_HEALTH_PATH=/api/app/health
PARKKING_APP_READY_PATH=/api/app/ready
PARKKING_APP_ENABLE_GEOCODER=true
PARKKING_APP_ENABLE_ROUTING=true
PARKKING_APP_ENABLE_PARKING_ANSWER=true
PARKKING_APP_ENABLE_SYNC=true

PARKKING_PARKING_ANSWER_PORT=8790
PARKKING_PARKING_ANSWER_PATH=/api/parking-answer
PARKKING_PARKING_ANSWER_DATASET_ROOT=public/data/generated
PARKKING_PARKING_ANSWER_DISTRICTS=xinyi,daan,zhongshan
PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT=xinyi
PARKKING_PARKING_ANSWER_DEFAULT_HHMM=21:00
PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR=false

PARKKING_SYNC_PORT=8789
PARKKING_SYNC_PATH=/api/sync
PARKKING_SYNC_FILE=.tmp/sync-service.json
PARKKING_SYNC_DEFAULT_SCOPE=default
PARKKING_SYNC_MAX_BODY_BYTES=1048576
PARKKING_SYNC_MAX_ISSUE_REPORTS=1000
PARKKING_SYNC_CORS_ORIGINS=*
PARKKING_SYNC_WRITE_RATE_LIMIT_WINDOW_MS=60000
PARKKING_SYNC_WRITE_RATE_LIMIT_MAX=120
```

Basemap env vars:
- `VITE_MAP_STYLE_URL`: full MapLibre style URL. If set, raster settings are ignored.
- `VITE_MAP_RASTER_URL`: raster tile template used when `VITE_MAP_STYLE_URL` is unset.
- `VITE_MAP_ATTRIBUTION`: raster attribution string shown in the map control.
- `VITE_MAP_RASTER_MAX_ZOOM`: raster source max zoom.
- `VITE_MAP_RASTER_TILE_SIZE`: raster tile size, usually `256` or `512`.

Geocoder env vars:
- `VITE_GEOCODER_URL`: browser-side geocoder endpoint. Recommended value is `/api/geocode`.
- `VITE_GEOCODER_FALLBACK_URL`: optional browser-side fallback endpoint. Leave empty when the proxy handles fallback.
- `VITE_GEOCODER_LIMIT`: max results returned per request.
- `VITE_GEOCODER_COUNTRY_CODES`: optional comma-separated ISO country codes, e.g. `tw,jp`.

Routing env vars:
- `VITE_ROUTING_URL`: browser-side routing endpoint. Recommended value is `/api/route`.
- `VITE_ROUTING_FALLBACK_URL`: optional browser-side fallback endpoint for route summaries.

Parking answer env vars:
- `VITE_PARKING_ANSWER_URL`: browser-side exact parking-answer endpoint. Leave empty for the same-origin `/api/parking-answer` proxy in dev/preview.

ParkKing sync env vars:
- `VITE_SYNC_BASE_URL`: first-party sync service base URL used for both trip-board plans and reports.
- `VITE_SYNC_BOOTSTRAP_PATH`: bootstrap resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `bootstrap`.
- `VITE_SYNC_STATUS_PATH`: metadata/status resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `status`.
- `VITE_SYNC_READINESS_PATH`: readiness resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `ready`.
- `VITE_SYNC_SAVED_PLANS_PATH`: saved-plan resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `saved-plans`.
- `VITE_SYNC_REPORTS_PATH`: report resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `reports`.
- `VITE_SYNC_ISSUES_PATH`: issue-report resource path appended to `VITE_SYNC_BASE_URL`. Defaults to `issues`.
- `VITE_SYNC_SCOPE`: optional shared scope appended to both sync resources so multiple clients can use the same backend without colliding.
- On `localhost`, the app defaults to the Vite-mounted ParkKing sync service at `/api/sync` when `VITE_SYNC_BASE_URL` is unset.

Saved-plan sync env vars:
- `VITE_SAVED_PLANS_URL`: legacy saved-plan sync endpoint override. Use only when `VITE_SYNC_BASE_URL` is not configured.

Report sync env vars:
- `VITE_REPORTS_URL`: legacy report sync endpoint override. Use only when `VITE_SYNC_BASE_URL` is not configured.

Issue report sync env vars:
- `VITE_ISSUE_REPORTS_URL`: legacy issue-report upload endpoint override. Use only when `VITE_SYNC_BASE_URL` is not configured.

Geocoder proxy env vars:
- `PARKKING_GEOCODER_PRIMARY_URL`: upstream Nominatim-compatible endpoint used by the proxy.
- `PARKKING_GEOCODER_FALLBACK_URL`: optional backup upstream endpoint used when the primary is unavailable.
- `PARKKING_GEOCODER_COUNTRY_CODES`: server-side comma-separated ISO country code filter.
- `PARKKING_GEOCODER_LIMIT`: max upstream result count per request.
- `PARKKING_GEOCODER_CACHE_TTL_MS`: cache TTL in milliseconds for positive and empty results.
- `PARKKING_GEOCODER_REQUEST_TIMEOUT_MS`: max time for each upstream geocoder request before the proxy aborts and tries the next attempt/provider.
- `PARKKING_GEOCODER_CACHE_FILE`: file-backed cache path for proxy responses.
- `PARKKING_GEOCODER_USER_AGENT`: user agent sent to upstream geocoder providers.
- `PARKKING_GEOCODER_PORT`: standalone proxy port.
- `PARKKING_GEOCODER_PATH`: proxy route path. Defaults to `/api/geocode`.

Routing proxy env vars:
- `PARKKING_ROUTING_PRIMARY_URL`: upstream OSRM-compatible base URL used by the proxy.
- `PARKKING_ROUTING_FALLBACK_URL`: optional backup upstream endpoint used when the primary is unavailable.
- `PARKKING_ROUTING_CACHE_TTL_MS`: cache TTL in milliseconds for route summaries.
- `PARKKING_ROUTING_REQUEST_TIMEOUT_MS`: max time for each upstream routing request before the proxy aborts and tries the fallback provider.
- `PARKKING_ROUTING_CACHE_FILE`: file-backed cache path for route summary responses.
- `PARKKING_ROUTING_USER_AGENT`: user agent sent to upstream routing providers.
- `PARKKING_ROUTING_PORT`: standalone proxy port.
- `PARKKING_ROUTING_PATH`: proxy route path. Defaults to `/api/route`.

Unified app server env vars:
- `PORT` / `PARKKING_APP_PORT`: production-style app server port. `PARKKING_APP_PORT` wins when both are set.
- `PARKKING_APP_HOST`: optional bind host. Leave empty to use Node's default bind address.
- `PARKKING_APP_STATIC_DIR`: built static directory served by `npm start`. Defaults to `dist`.
- `PARKKING_APP_SPA_FALLBACK`: serves `index.html` for non-API routes when enabled.
- `PARKKING_APP_HEALTH_PATH`: app-server liveness path. Defaults to `/api/app/health`.
- `PARKKING_APP_READY_PATH`: app-server readiness path. Defaults to `/api/app/ready` and fails when the built `index.html` is missing.
- `PARKKING_APP_ENABLE_GEOCODER`, `PARKKING_APP_ENABLE_ROUTING`, `PARKKING_APP_ENABLE_PARKING_ANSWER`, `PARKKING_APP_ENABLE_SYNC`: opt out of individual same-origin APIs when a deployment routes them elsewhere.

Parking answer service env vars:
- `PARKKING_PARKING_ANSWER_PORT`: standalone parking-answer service port.
- `PARKKING_PARKING_ANSWER_PATH`: service route path. Defaults to `/api/parking-answer`.
- `PARKKING_PARKING_ANSWER_DATASET_ROOT`: root directory containing generated district packs.
- `PARKKING_PARKING_ANSWER_DISTRICTS`: comma-separated districts allowed through the service.
- `PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT`: district used when a request omits `district`.
- `PARKKING_PARKING_ANSWER_DEFAULT_HHMM`: time used when a request omits `hhmm`.
- `PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR`: enables explicit `datasetDir` query params for local/debug use. Keep disabled for normal deployments.

Sync service env vars:
- `PARKKING_SYNC_PORT`: standalone sync service port.
- `PARKKING_SYNC_PATH`: sync route path. Defaults to `/api/sync`.
- `PARKKING_SYNC_FILE`: file-backed sync store path.
- `PARKKING_SYNC_DEFAULT_SCOPE`: fallback scope used when the request does not include a `scope` query param.
- `PARKKING_SYNC_MAX_BODY_BYTES`: max JSON request body accepted by saved-plan, report, and issue-report write endpoints. Defaults to `1048576`; oversized requests return HTTP 413.
- `PARKKING_SYNC_MAX_ISSUE_REPORTS`: max synced issue reports retained per scope. Defaults to `1000`; older reports are trimmed on new issue-report writes.
- `PARKKING_SYNC_CORS_ORIGINS`: comma-separated browser origins allowed to call the sync service. Defaults to `*` for local/standalone use. Production deployments must set explicit app origins; the checked-in Render blueprint uses `https://parkking.onrender.com`.
- `PARKKING_SYNC_WRITE_RATE_LIMIT_WINDOW_MS`: fixed-window rate-limit duration for saved-plan, report, and issue-report writes. Defaults to `60000`.
- `PARKKING_SYNC_WRITE_RATE_LIMIT_MAX`: max writes per client, route, and scope within the rate-limit window. Defaults to `120`; excess writes return HTTP 429 with `Retry-After`.

Proxy runtime:
- `npm run dev` and `npm run preview` already mount the proxy route at `/api/geocode`.
- `npm start` serves the built `dist` directory and mounts geocoder, routing, parking-answer, and sync APIs in one Node process for production-style deployments.
- The unified app server exposes liveness at `/api/app/health` and static-readiness at `/api/app/ready`; unknown `/api/*` routes return JSON 404 instead of falling through to the SPA shell.
- After `npm run build`, run `npm run ops:smoke-app-server` to start that same server on a random local port and verify app readiness, parking-answer readiness, static root serving, and API 404 behavior.
- For a standalone process, run `npm run ops:geocode-proxy`.
- The geocoder proxy exposes liveness at `/api/geocode/health` and config readiness at `/api/geocode/ready`.
- In local browser sessions on `localhost`, address search defaults to `/api/geocode` when `VITE_GEOCODER_URL` is unset.
- `npm run dev` and `npm run preview` also mount the route proxy at `/api/route`.
- For a standalone process, run `npm run ops:routing-proxy`.
- The route proxy exposes liveness at `/api/route/health` and config readiness at `/api/route/ready`.
- Routing requests default to `/api/route` unless `VITE_ROUTING_URL` is set.
- `npm run dev` and `npm run preview` mount the exact parking-answer service at `/api/parking-answer`.
- For a standalone process, run `npm run ops:parking-answer-api`.
- The same service exposes liveness at `/api/parking-answer/health` and dataset readiness at `/api/parking-answer/ready`.
- Exact pinned-location answers default to `/api/parking-answer` in local dev/preview. Static deployments without that endpoint fall back to the loaded client dataset.
- `npm run dev` and `npm run preview` now also mount the first-party sync service at `/api/sync`.
- For a standalone process, run `npm run ops:sync-service`.
- The sync service exposes liveness at `/api/sync/health` and store readiness at `/api/sync/ready`; readiness includes the configured max request body size.

Current geocoder strategy:
1. Browser sends address requests to `/api/geocode` or the configured client endpoint.
2. Before same-origin ParkKing proxy requests, the browser checks `/api/geocode/ready` and surfaces degraded proxy configuration as an address-search error.
3. Direct external geocoder endpoints, such as Nominatim-compatible URLs, skip the ParkKing readiness probe.
4. Proxy searches the primary provider inside the active district bounds when bounds exist.
5. Proxy retries the same provider without district bounds if the bounded search returns nothing.
6. Proxy retries the same bounded/unbounded sequence against `PARKKING_GEOCODER_FALLBACK_URL` when configured.
7. Each upstream geocoder request is bounded by `PARKKING_GEOCODER_REQUEST_TIMEOUT_MS`.
8. Responses are cached on disk, including empty result sets.
9. If network geocoding still fails, the UI keeps local road/segment text filtering active.

Current routing strategy:
1. Browser sends route summary requests to `/api/route` or the configured routing endpoint.
2. Before same-origin ParkKing proxy requests, the browser checks `/api/route/ready` and surfaces degraded proxy configuration in the ETA note.
3. Direct external routing endpoints skip the ParkKing readiness probe.
4. Proxy forwards those requests to the primary OSRM-compatible upstream with `table` lookups for walking and driving.
5. Proxy retries the same request against `PARKKING_ROUTING_FALLBACK_URL` when configured.
6. Each upstream routing request is bounded by `PARKKING_ROUTING_REQUEST_TIMEOUT_MS`.
7. Responses are cached on disk per origin, destination set, and profile.
8. If live routing fails, the UI falls back to heuristic walk distance and keeps external `Go there` links active.

Current parking answer strategy:
1. Browser pinned-location answers first call `/api/parking-answer` or `VITE_PARKING_ANSWER_URL`.
2. The browser checks `/ready` before exact service requests; degraded readiness is shown in the pinned-answer panel while the local loaded dataset fallback remains available.
3. Before either answer path runs, the browser checks the pinned location against the active district polygon in `/data/coverage.json` (falling back to dataset bounds if the catalog is unavailable). Out-of-coverage locations remain visible on the map but do not receive a parking answer or recommendation from another district's data.
4. Address and map-pin selection use that same polygon catalog to switch only to production districts present in the published registry; candidate and source-only areas are never selected as active datasets.
5. Known non-active areas report their actual coverage stage: all 12 Taipei districts are reviewed production coverage, Shipai is tracked under Beitou without claiming that a Beitou polygon match proves the point is inside Shipai, and Taoyuan reports paid-curb-reference-only capability without claiming curb legality.
6. The service loads the generated district pack, applies reviewed sign overrides, parking-space evidence, inferred candidates when requested, zone rules, and ranking trust.
7. The response includes `schemaVersion`, dataset hash, primary answer, alternatives, evidence, caveats, and the same trust summary rendered in the UI.
8. The service caches evaluated segments per `datasetDir` and `hhmm` for the process lifetime.
9. `/health` returns service config liveness; `/ready` verifies required generated layers for the configured default and allowed districts, including parseable sign overrides and inferred candidates, and returns HTTP 503 when any are missing or malformed.
10. If no configured API is available in a static deployment, the UI falls back to the local loaded dataset answer path instead of hiding the pinned answer card.

Current saved-plan sync strategy:
1. Trip-board state loads from browser storage immediately.
2. On `localhost`, the app defaults to the Vite-mounted ParkKing sync service at `/api/sync`.
3. When a first-party sync base exists, the app bootstraps saved plans and reports together from `VITE_SYNC_BOOTSTRAP_PATH`.
4. If `VITE_SYNC_BASE_URL` is configured, normal saved-plan writes use the resource under `VITE_SYNC_SAVED_PLANS_PATH`.
5. If no shared base URL is configured, the app falls back to `VITE_SAVED_PLANS_URL` when present.
6. If `VITE_SYNC_SCOPE` is set, that scope is appended to the sync endpoint so the backend can keep separate buckets.
7. Valid remote responses refresh the local cache.
8. Remote failures or malformed payloads fall back to the local cache without clearing it.
9. Trip-board edits always update the local cache first, then attempt a best-effort `PUT` sync to the configured endpoint.
10. First-party saved-plan sync is revision-aware: bootstrap/load responses cache the current server revision, and `409` conflicts trigger one merge-and-retry pass instead of blindly overwriting newer remote plans.
11. The first-party sync service also exposes readiness and status resources so the UI can detect degraded sync storage and remote changes without auto-overwriting local state.

Current report sync strategy:
1. Segment reports load from browser storage immediately.
2. On `localhost`, the app defaults to the Vite-mounted ParkKing sync service at `/api/sync`.
3. When a first-party sync base exists, the app bootstraps saved plans and reports together from `VITE_SYNC_BOOTSTRAP_PATH`.
4. If `VITE_SYNC_BASE_URL` is configured, normal report writes use the resource under `VITE_SYNC_REPORTS_PATH`.
5. If no shared base URL is configured, the app falls back to `VITE_REPORTS_URL` when present.
6. If `VITE_SYNC_SCOPE` is set, that scope is appended to the sync endpoint so the backend can keep separate buckets.
7. Valid remote responses merge into the local cache instead of replacing unsynced local reports.
8. Remote failures or malformed payloads fall back to the local cache without clearing it.
9. New legality reports always write locally first, then attempt a best-effort `POST` sync to the configured endpoint.
10. First-party report sync also tracks remote revisions so the UI can tell when newer shared reports exist.

Current issue report strategy:
1. `Report issue` writes an issue report locally first, including the current debug bundle snapshot: dataset metadata, current mode/time, selected segment geometry, parking-rule reasons, ranking details, and nearby-zone counts.
2. When the first-party sync service is available, the app also sends that issue report to `/api/sync/issues`.
3. Synced issue reports are stored alongside saved plans and legality reports in the file-backed sync store.
4. Nightly ops, manual triage CLI runs, and workflow artifacts all read from that same synced issue report store.

Notes:
- The app and proxy expect a Nominatim-style JSON response with `display_name`, `lat`, `lon`, and optional `boundingbox`.
- Public Nominatim instances are rate-limited. For production use, prefer your own proxy or a provider with explicit usage terms.
- The routing proxy expects an OSRM-compatible `table` response with `durations`, `distances`, and `code`.

## Install Hygiene

- Do not commit or zip `node_modules/`.
- Do not commit large generated build outputs such as `dist/` or `data/generated/**`.
- For clean, reproducible installs in a clone, run `npm ci`.

## Add District

### Inputs

Place raw inputs under a dedicated folder, e.g. `data/raw/<districtId>`.

Required inputs (default scaffold names):
- `district_bounds.shp`
- `red_yellow.shp`
- `bus_stops.shp`
- `hydrants.shp`

Optional inputs:
- `road_centerlines.shp`
- `crosswalks.shp`
- `sign_overrides.geojson`

### Config Schema (scaffolded)

`configs/prod/<districtId>.json` is created by the scaffolder only when a
district is ready for the reviewed release lane. New districts should start in
`configs/expansion/<districtId>.json` so dry runs and review packets can be built
without changing the production publish glob.

```json
{
  "districtId": "xinyi",
  "districtName": "Xinyi",
  "inputs": {
    "districtBounds": "../../data/raw/xinyi/district_bounds.shp",
    "redYellow": "../../data/raw/xinyi/red_yellow.shp",
    "busStops": "../../data/raw/xinyi/bus_stops.shp",
    "hydrants": "../../data/raw/xinyi/hydrants.shp",
    "road_centerlines": "../../data/raw/xinyi/road_centerlines.shp",
    "crosswalks": "../../data/raw/xinyi/crosswalks.shp",
    "sign_overrides": "../../data/raw/xinyi/sign_overrides.geojson"
  },
  "outputs": {
    "generatedDir": "../../data/generated/xinyi",
    "publicDir": "../../public/data/generated/xinyi"
  },
  "crs": { "default": "EPSG:3826" },
  "ops": { "thresholds": { "counts": { "segments": 20 } } }
}
```

### Deterministic Command Sequence

1. Scaffold candidate config outside the production release glob:
   `npm run ops:new-district -- --districtId songshan --districtName "Songshan" --sourceRoot "data/sources/shared" --outputRoot configs/expansion --sourcePreset taipei-shared --boundaryFeatureId 63001`
2. Validate candidate inputs:
   `npm run ops:check-inputs -- --config configs/expansion/songshan.json`
3. Dry-run candidate ingest/review work:
   `npm run ingest:all -- --configs "configs/expansion/songshan.json" --dry-run --report-only --allow-warn --override "songshan expansion candidate baseline bootstrap"`
4. Promote the config to `configs/prod/<id>.json` only after review evidence and pinned answer cases are ready.

Taipei-wide expansion is tracked in `configs/coverage.expansion.json`. The 12 official
districts now have either production or expansion configs; Shipai is represented through
its parent Beitou district and is not treated as a separate administrative district. Its
current QA bundle is a 1.5 km anchor sample, not an authoritative Shipai boundary, so the
runtime catalog marks `standaloneBoundaryRequired: true` and the UI does not infer that
every Beitou match is inside Shipai. Check the contract with `npm run ops:coverage-status`.
Rebuild the browser-safe 25-district
boundary/status catalog from the downloaded official sources with
`npm run ops:build-coverage-catalog`, then verify it against the manifest with
`npm run ops:validate-coverage-catalog`. Candidate and source-only entries in this catalog
are geographic status metadata only; they do not enter the published dataset registry.

Taoyuan is intentionally source-only until equivalent curb-legality inputs exist. Fetch and
unpack its official administrative boundaries and fare metadata with
`npm run ops:fetch-taoyuan-sources` and `npm run ops:unpack-taoyuan-sources`, then verify
all 13 boundaries and build the deterministic text-reference pack with
`npm run ops:build-taoyuan-expansion`. This writes
`public/data/reference/taoyuan-paid-curb.json` and a Taoyuan District source-text review
bundle under `.tmp/taoyuan-human-review/`. Run
`npm run ops:build-taoyuan-review-all` to produce isolated review bundles for every
district with source records. The current official XML contains 944 records across 11
non-empty districts, including 270 for Taoyuan District; Xinwu and Fuxing currently have
zero records. The dataset has no coordinates. Human approval of a CSV confirms source
transcription only and never confirms parking legality. Rebuilds refresh each
`.template.csv` file but preserve an existing review CSV. A clean checkout builds these
handoffs from the tracked deterministic reference pack and seeds only tracked review
evidence that still passes its pinned CSV hash and full approval gate. Run
`npm run ops:taoyuan-review-index` for one live-validated status table across all manifests
in the authoritative bundle directory; this writes
`.tmp/taoyuan-city-review-status.md/json` and does not rely on stale status snapshots.
Run `npm run ops:package-taoyuan-reviews` to create one checksummed ZIP containing only
pending or needs-resolution district CSVs, templates, manifests, and the source reference.
Invalid evidence blocks packaging, while approved districts are listed but excluded from
the reviewer workload. The manual `Taoyuan Source Review Handoff` workflow runs build,
index, and packaging from a clean checkout and retains the downloadable artifact for 30
days.
After the project owner explicitly approves every still-pending row in one exact package,
apply that decision with `npm run ops:approve-taoyuan-review-package -- --package <zip>
--expected-sha256 <sha256> --approve-all`. The importer verifies the outer package hash,
every inventoried file hash, the tracked source reference, immutable source fields, and
the source-text-only safety contract. It refuses to override any `NEEDS_CORRECTION` or
`UNCLEAR` row and writes the approved CSVs only to the local authoritative review bundle.
Check one district's structure, source hash, and pending counts with
`npm run ops:taoyuan-review-status -- --district zhongli --review-dir .tmp/taoyuan-human-review`;
require every draft row to be explicitly approved with
`npm run ops:taoyuan-review-gate -- --district zhongli --review-dir .tmp/taoyuan-human-review`.
Run `npm run ops:promote-ready-taoyuan-reviews` to preview which fully approved
districts can be installed. Add `-- --execute` to promote only those approved districts;
the command skips pending or needs-resolution districts and blocks invalid evidence.
Add `--require-all-approved` when the batch must remain non-zero until every selected
district is approved.
After project-owner approval, run
`npm run ops:promote-taoyuan-review -- --district zhongli`; the command
revalidates every immutable field and source hash before installing the approved CSV
and manifest under `review-evidence/taoyuan/`. The promoted manifest pins the reviewed
CSV SHA-256 and approved row count. Status, gate, readiness,
and CI commands read this tracked evidence so a clean checkout reproduces the decision.
With TDX
guest access, or credentials in `TDX_CLIENT_ID` and `TDX_CLIENT_SECRET`, run
`npm run ops:fetch-taoyuan-paid-curb` to normalize paid curb segment geometry/reference
points. Guest access is used only when credentials are absent and can be disabled with
`TDX_ALLOW_GUEST=false`. The output records its acquisition mode, coordinate correction
count, and dropped-record count. A swapped point is repaired only when the original pair
is invalid and the reversed pair is inside the Taoyuan range. The output uses
`PAID_CURB_SEGMENT` with `legalAnswerEligible: false`; it must not be
renamed to `parking_spaces.geojson` or used to produce a general legal parking answer.
For a CI handoff, manually run the `Taoyuan Spatial Reference` workflow and select a
district whose source-text review has been promoted. It uses guest
access when the optional repository secrets are absent and applies the spatial-only
`--require-spatial` gate. It then joins the TDX IDs to the tracked approved review, checks
every text field, excludes points outside the official district boundary, and uploads the
normalized source, browser-safe reference pack, promotion receipt, and readiness reports
for 14 days. It fails closed if the generated runtime content differs from the tracked
public pack, while the `if: always()` upload still preserves the changed artifact for
review. Source-artifact hash-only changes are treated as provenance rather than runtime
content drift. This workflow does not commit, ingest, or deploy the artifact.
After a successful run, install the downloaded artifact without bypassing its safety gate:

```powershell
gh run download <run-id> --name taoyuan-spatial-reference-zhongli --dir .tmp/taoyuan-spatial-reference
npm run ops:install-taoyuan-spatial-reference
npm run ops:taoyuan-expansion-readiness:strict -- --district zhongli --boundary-catalog public/data/coverage.json
npm run ops:promote-taoyuan-spatial-reference -- --district zhongli
npm run ops:build-coverage-catalog
npm run ops:validate-coverage-catalog
```

The installer validates every feature before atomically replacing
`data/sources/taoyuan/paid_curb_segments.geojson` and writes a SHA-256 receipt to
`.tmp/taoyuan-spatial-reference-install.json`. Invalid, empty, or legal-answer-eligible
artifacts never replace an existing reference.
Each promoted district receives its own
`public/data/reference/<district>-paid-curb-points.geojson` browser pack, and coverage
catalog generation discovers all such packs. The tracked packs currently cover 10
districts and publish 769 of 803 reviewed records as `REPRESENTATIVE_POINT` features.
Thirty-four source points are excluded because they fall outside the official district
boundary. A district with any live TDX/source-text mismatch remains text-only until the
changed text is reviewed. These points help users locate and inspect official paid-curb
source records, but they are not curb-line geometry, parking-space inventory, or proof
that parking is legal. The runtime parser, coverage catalog, and UI all keep
`legalAnswerEligible: false`.
Run `npm run ops:taoyuan-expansion-readiness:report` to verify the 13 official boundaries,
944-row text pack, 270-row source-text review, optional saved/guest/credentialed TDX geometry,
and the non-legal safety contract in one report. The report exits successfully when the
only blockers are expected human or external inputs. Use
`npm run ops:taoyuan-expansion-readiness:strict` when a milestone must remain non-zero
until source text is fully approved and a valid TDX spatial-reference artifact exists.
CI uses the tracked runtime coverage catalog as explicit derived boundary evidence; local
and strict runs default to the unpacked official shapefile instead of silently falling back.
Even strict readiness only approves a spatial reference layer; legal-answer eligibility
remains false. The credential-free
[Taoyuan roadside fee dataset](https://data.gov.tw/dataset/149456) exposes text/fare fields
but no coordinates, so address text must not be converted into synthetic geometry.
When a source-only Taoyuan address is pinned, the app can filter this official text by
Chinese road name and show the reviewed representative points on the map. Text results are
road-description matches rather than proximity matches, and map points remain references
rather than curb geometry or legality answers. Clicking a reference point opens its
official segment ID, road description, fare text, charging flag, and representative
coordinates without moving the parking-evaluation pin. Filtered source-text rows with
a reviewed point can highlight and focus that point on the map; rows excluded by the
official district-boundary review remain text-only and never receive synthetic geometry.

Legacy per-district raw source scaffold:
   `npm run ops:new-district -- --districtId <id> --districtName "<Name>" --sourceRoot "data/raw/<id>"`
1. Validate inputs:
   `npm run ops:check-inputs -- --config configs/prod/<id>.json`
2. Ingest + publish:
   `npm run ingest:all -- --configs "configs/prod/<id>.json"`

Optional override (when publish gate warns and you still need to publish):
`npm run ingest:all -- --configs "configs/prod/<id>.json" --allowWarn --override "<reason>"`

### Expected Outputs

After ingest + publish:
- `data/generated/<id>/dataset_meta.json`
- `public/data/generated/<id>/dataset_meta.json`
- `public/data/generated/<id>/LATEST.json`
- `public/data/generated/<id>/<pack>.zip`
- `public/data/generated/registry.json`
- `public/data/generated/ingest_all_report.json`

## Local Runtime Data Sync

Runtime loading uses `public/data/generated/<districtId>/...`.

- Sync local generated packs into runtime path:
  `npm run ops:sync-public-data`
- Fast runtime layout smoke check:
  `npm run ops:smoke-public-data`
- Runtime pack inventory that separates registry-published districts from stale local folders:
  `npm run ops:generated-pack-inventory -- --root public/data/generated`
- District readiness matrix across prod configs, runtime packs, dry-run packs, and QA review files:
  `npm run ops:district-readiness-matrix`
- Human review bundle index for `.tmp/*-human-review` handoff packets:
  `npm run ops:human-review-index -- --out .tmp/human-review-index.md --json-out .tmp/human-review-index.json`
  Area-scoped aliases such as Shipai resolve their district and artifact names from the QA
  manifest. Specialized source-text bundles such as Taoyuan are listed separately with their
  dedicated status and approval-gate commands; they are never treated as P0 legal-answer QA.
- Package districts that still need human review into zip handoff files:
  `npm run ops:package-human-reviews -- --district daan,zhongshan`
  For expansion candidates that are not yet promoted to `configs/prod`, pass
  `--config-root configs/expansion` so generated validation/finalize commands
  point at the candidate config.
- Row-level audit for filled or partially filled human review handoff CSVs:
  `npm run ops:review-handoff-audit -- --district daan,zhongshan`
  `npm run ops:review-handoff-audit -- --district daan,zhongshan --priority-out .tmp/human-review-priority.md --priority-csv-out .tmp/human-review-priority.csv --priority-json-out .tmp/human-review-priority.json`
  `npm run ops:review-handoff-audit -- --district daan,zhongshan --strict`
- Safely advance selected P0 review bundles to the next available step:
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan`
  For expansion candidates, add `--config-root configs/expansion` so package,
  intake validation, and finalize-ready commands continue to use the candidate
  config instead of `configs/prod`.
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --review-intake --include-common-dirs`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --review-intake --include-common-dirs --out .tmp/p0-advance-reviews.md --json-out .tmp/p0-advance-reviews.json`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --review-intake --include-common-dirs --validate-ready`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --review-intake --include-common-dirs --validate-ready --require-ready-to-finalize`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --review-intake --include-common-dirs --validate-ready --require-ready-to-finalize --execute`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --require-ready-to-finalize`
  `npm run ops:p0-advance-reviews -- --district daan,zhongshan --execute`
- Strict P0 review gate shortcut for CI/release checks:
  `npm run ops:p0-review-gate -- --district daan,zhongshan`
  `npm run ops:p0-review-gate -- --district daan,zhongshan --execute`
  `npm run ops:p0-review-gate-report -- --district daan,zhongshan`
- Scan `.tmp`, Desktop, and Downloads for returned reviewer CSVs before finalizing:
  `npm run ops:p0-review-intake -- --district daan,zhongshan --include-common-dirs --out .tmp/p0-review-intake.md --json-out .tmp/p0-review-intake.json`
  `npm run ops:p0-review-intake -- --district daan,zhongshan --include-common-dirs --validate-ready`
  Use `--config-root configs/expansion` for returned reviews from expansion
  packages that are not promoted to prod yet.
- Validate a filled priority-review CSV before running finalize:
  `npm run ops:p0-validate-priority-review -- --district daan --reviews .tmp/human-review-priority.csv --allow-publish-warn --publish-override "daan reviewed first-publish baseline bootstrap"`
- Dry-run or execute P0 closure for districts whose human-review handoff is already ready:
  `npm run ops:p0-finalize-ready-reviews -- --district daan,zhongshan`
  `npm run ops:p0-finalize-ready-reviews -- --district daan,zhongshan --execute`
  Use `--config-root configs/expansion` when finalizing a ready expansion
  handoff before promotion to `configs/prod`.
- Strict inventory check for CI or release prep:
  `npm run ops:generated-pack-inventory -- --root public/data/generated --strict`
- Bulk answerability smoke check for every generated district pack:
  `npm run ops:smoke-generated-packs -- --root public/data/generated`
- Registry-scoped smoke check that ignores stale generated directories:
  `npm run ops:smoke-generated-packs -- --root public/data/generated --registry public/data/generated/registry.json`
- Dry-run report-scoped smoke check:
  `npm run ops:smoke-generated-packs -- --root data/generated --report data/generated/ingest_all_report_dry.json --fixture-thresholds`
- Fixture-pack bulk smoke check with relaxed non-Xinyi/marked-space thresholds:
  `npm run ops:smoke-generated-packs -- --root public/data/generated --registry public/data/generated/registry.json --fixture-thresholds`
- Bulk answerability smoke check for the current Xinyi pack:
  `npm run ops:smoke-parking-answers`
- Exact pinned-point answer smoke check for the current Xinyi pack:
  `npm run ops:smoke-exact-parking-answers -- --dataset-dir public/data/generated/xinyi --hhmm 21:00 --radius 25 --minParkAnswers 1 --minNoStopAnswers 1 --minMarkedSpaceParkAnswers 1 --cases configs/prod/xinyi.answer-cases.json`
- HTTP parking-answer API smoke check against reviewed Xinyi pinned cases:
  `npm run ops:smoke-parking-answer-api -- --district xinyi --timeout-ms 25000`
- HTTP parking-answer API smoke check against generated sample points, useful for CI fixture packs without reviewed cases:
  `npm run ops:smoke-parking-answer-api -- --district xinyi --no-cases --timeout-ms 25000 --minParkAnswers 1 --minNoStopAnswers 1 --minMarkedSpaceParkAnswers 1`
- Registry/report-scoped HTTP parking-answer API smoke check for every generated district pack:
  `npm run ops:smoke-parking-answer-apis -- --root public/data/generated --registry public/data/generated/registry.json --fixture-thresholds --timeout-ms 25000`
  `npm run ops:smoke-parking-answer-apis -- --root data/generated --report data/generated/ingest_all_report_dry.json --fixture-thresholds --timeout-ms 25000`
- Same-origin service health/readiness smoke check for geocode, route, sync, and parking-answer services:
  `npm run ops:smoke-api-services -- --timeout-ms 25000`
- Add `--sync-issue-roundtrip` when the gate must also prove `POST /api/sync/issues` followed by `GET /api/sync/issues` works for production feedback capture.
- Vite-preview-mounted service health/readiness plus sync issue-report roundtrip smoke check after `npm run build`:
  `npm run ops:smoke-api-services -- --start-preview --timeout-ms 25000 --sync-issue-roundtrip`
- Production bundle budget check after `npm run build`; this keeps MapLibre/Turf, `rbush`/zone-index, and geospatial fallback chunks out of the initial modulepreload path:
  `npm run ops:bundle-budget`
- Production UI smoke check for reviewed Xinyi pinned answers:
  `npm run build`
  `npm run ops:smoke-ui-parking-answers:preview -- --cases configs/prod/xinyi.answer-cases.json --district xinyi --timeout-ms 25000`
  Use the non-preview `ops:smoke-ui-parking-answers` command only when an app is already reachable at `--app-url` (default `http://127.0.0.1:4173`); otherwise use `:preview` so the smoke starts Vite preview itself.
  Per-case waits are bounded by `--timeout-ms`; the single-district suite defaults to twice that budget, while `ops:smoke-reviewed-ui-packs` shares three times that budget across all districts. Override either with `--suite-timeout-ms`. Use `--no-dataset-hash-check` only for deliberate fixture tests where runtime dataset metadata is unavailable.
- Production MAP-mode reviewed-answer smoke check after `npm run build`; this confirms a reviewed pinned answer renders correctly in the map/list shared-link mode:
  `npm run ops:smoke-ui-parking-answers-map:preview -- --cases configs/prod/xinyi.answer-cases.json --district xinyi --limit 1 --timeout-ms 25000`
- Production MAP-mode UI smoke check after `npm run build`; this confirms the shared-link MAP route renders the map panel, legend, dataset counts, and a real MapLibre canvas:
  `npm run ops:smoke-ui-map:preview -- --district xinyi --timeout-ms 25000`
- Production issue-report UI smoke after `npm run build`; this clicks `Report issue`, verifies local issue storage, remote `/api/sync/issues` upload, and debug-bundle download:
  `npm run ops:smoke-ui-issue-report:preview -- --district xinyi --timeout-ms 25000`
- Production Taoyuan paid-curb reference UI smoke after `npm run build`; the district-driven fixture verifies that a reviewed source row opens its representative point without changing the pinned address or producing a parking-legality answer, and that a boundary-excluded row remains text-only:
  `npm run ops:smoke-ui-paid-curb-reference:preview -- --district xinyi --reference-district taoyuan-district --timeout-ms 60000`
  Use `--reference-district guishan` to run the same safety contract against Guishan's reviewed text and representative-point packs.
- Current-product P1 release readiness gate for the Xinyi flow:
  `npm run build`
  `npm run ops:p1-release-readiness`
  This fails on Xinyi P0 readiness, production bundle budget, API service probes including the sync issue-report write/read roundtrip, parking-answer API smoke, reviewed UI answer smoke, MAP-mode reviewed-answer smoke, MAP-mode UI regressions, Taoyuan paid-curb source-to-map safety regressions, or issue-report UI submission regressions. It also reports Daan/Zhongshan district blockers without failing the current-product gate unless `--strict-matrix` is supplied.
  The production publish workflow runs this automatically when `configsGlob` is `configs/prod/*.json`.
- P1 release data package:
  `npm run ops:package-release:xinyi`
  `npm run ops:validate-release-package:xinyi`
  This writes a Xinyi-scoped `dist/releases/park-king-data_<releaseId>.zip` and `dist/releases/release_manifest_<releaseId>.json`, then prints the exact zip path, manifest path, included district, file count, and total bytes for handoff. The scoped archive also rewrites the packaged `registry.json` to list only the selected district. The validator reads the latest zip/manifest pair, verifies file list, bytes, sha256, packaged registry districts, and rejects any non-Xinyi district file; pass `--out .tmp/p1-release-package.md --json-out .tmp/p1-release-package.json` when a workflow needs durable validation artifacts. CI uses `npm run ops:ci-optional-p1-release`, which runs the same P1 package gate only when generated release packs already exist in the checkout; clean CI checkouts skip it and rely on fixture ingest smoke plus the publish workflow for product release gates.
- P2 expansion readiness gate for the next districts:
  `npm run ops:p2-expansion-readiness -- --expansion-district daan,zhongshan --out .tmp/p2-expansion-readiness.md --json-out .tmp/p2-expansion-readiness.json`
  This keeps Xinyi tied to P1 readiness while classifying Daan/Zhongshan as either automation-blocked, human-review-required, or ready-to-finalize. It does not treat pending human review as a code failure, and it must not be used to auto-approve review evidence. Use `npm run ops:p2-expansion-readiness:report -- --expansion-district daan,zhongshan` to refresh the markdown/JSON artifacts, and use `npm run ops:p2-expansion-readiness:strict -- --expansion-district daan,zhongshan` when a milestone must fail until expansion districts are ready to finalize. For candidate districts that live under `configs/expansion`, pass `--configs "configs/expansion/*.json"`; the command infers `--config-root configs/expansion` for generated human-review finalize commands, or you can pass `--config-root configs/expansion` explicitly. To keep Xinyi in the same matrix while checking a candidate, use comma-separated configs such as `--configs "configs/prod/xinyi.json,configs/expansion/songshan.json"` and pass `--config-root configs/expansion` explicitly.
- P2 single status report:
  `npm run ops:p2-status`
  This writes `.tmp/p2-status.md` and `.tmp/p2-status.json` by combining current readiness, strict readiness, returned-review intake, review gate, handoff audit, and the latest reviewer zip paths under `.tmp/human-review-packages`. It exits cleanly when the only blocker is pending human review, and exits non-zero only for automation blockers that need code/data repair. When called with expansion candidate configs, for example `npm run ops:p2-status -- --expansion-district songshan --configs "configs/expansion/*.json" --skip-p1 --report-only`, it propagates the inferred `configs/expansion` root into readiness and review-gate commands. For mixed prod/candidate configs, pass `--config-root configs/expansion` explicitly so review-gate finalize commands target the candidate files.
  CI also uploads the same P2 status and review diagnostics with explicit `--report-only` flags so Daan/Zhongshan expansion blockers are visible without blocking the current Xinyi release gate; unhandled CLI errors still fail the workflow.
- State-driven P2 candidate advance for any single expansion district:
  `npm run ops:p2-candidate-advance -- --district songshan`
  `npm run ops:p2-candidate-advance:execute -- --district songshan`
  This derives the mixed `configs/prod/xinyi.json,configs/expansion/<district>.json` scope from the district ID, then follows the current state. It creates a missing human-review handoff, stops when real review evidence is required, validates/finalizes evidence that already passes the gate, and continues into expansion-config promotion in execute mode. It never fills or approves reviewer fields. Promotion deliberately stops before production ingest and prints the validated follow-up commands. Reports are written to `.tmp/p2-candidate-advance.md` and `.tmp/p2-candidate-advance.json`.
- Current Songshan P2 candidate shortcuts:
  `npm run ops:p2-songshan-status -- --report-only`
  `npm run ops:p2-songshan-human-review-handoff -- --report-only`
  `npm run ops:p2-songshan-review-diagnostics -- --report-only`
  `npm run ops:p2-songshan-review-intake`
  `npm run ops:p2-songshan-review-gate-report`
  `npm run ops:p2-songshan-review-gate`
  `npm run ops:p2-songshan-finalize-ready`
  `npm run ops:p2-songshan-finalize-ready:execute`
  `npm run ops:p2-songshan-promote`
  `npm run ops:p2-songshan-promote:execute`
  These backward-compatible shortcuts wrap the mixed Xinyi production plus Songshan expansion config set (`configs/prod/xinyi.json,configs/expansion/songshan.json`) and force `--config-root configs/expansion`, so review-gate/finalize commands write Songshan answer cases under `configs/expansion` until `ops:p2-songshan-promote:execute` deliberately copies reviewed files into `configs/prod`. New candidate districts should use `ops:p2-candidate-advance` instead of adding another district-specific script set. These shortcuts do not bypass human review; they only remove the long repeated command arguments.
- P2 human review handoff for Daan/Zhongshan:
  `npm run ops:p2-human-review-handoff`
  This packages the current `ready-for-review` bundles, writes `.tmp/p2-human-review-handoff.md` and `.tmp/p2-human-review-handoff.json`, and leaves the expansion readiness strict gate blocked until a human fills valid review rows. CI runs this as a report-only handoff helper and uploads `.tmp/human-review-packages/**` with the P2 status artifact.
- P2 review diagnostics for Daan/Zhongshan handoff rows:
  `npm run ops:p2-review-diagnostics`
  This writes `.tmp/p2-review-diagnostics.md` and `.tmp/p2-review-diagnostics.json` with row-level pending, missing-field, invalid-status, invalid-timestamp, bucket, segment, and first-priority-review details. It also writes `.tmp/p2-review-priority.md`, `.tmp/p2-review-priority.csv`, and `.tmp/p2-review-priority.json` so reviewers can focus on the minimum remaining rows first. Use it before finalize whenever a returned handoff CSV still does not pass the review gate.
- P2 returned-review intake and closure:
  `npm run ops:p2-review-intake`
  `npm run ops:p2-review-gate-report`
  `npm run ops:p2-review-gate`
  `npm run ops:p2-finalize-ready`
  `npm run ops:p2-finalize-ready:execute`
  `npm run ops:p2-promote-expansion -- --district <id>`
  `npm run ops:p2-promote-expansion -- --district <id> --execute`
  These shortcuts scan `.tmp`, Desktop, and Downloads for returned Daan/Zhongshan reviewer CSVs, validate ready files, and only finalize when the P0 review evidence already passes. They use `--actionable-only` so source CSVs are not reported as reviewer candidates. The `:execute` finalize script is the only review shortcut here that runs finalize. After a candidate finalizes into `configs/expansion/<id>.answer-cases.json`, dry-run `ops:p2-promote-expansion`, then run it with `--execute` to copy the reviewed config and answer cases into `configs/prod` before prod ingest/publish.
- P3 reviewed release readiness for all reviewed/published districts:
  `npm run ops:p3-release-readiness`
  This discovers reviewed districts from `configs/prod/*.answer-cases.json`, runs the strict district readiness matrix, runs reviewed generated-pack smoke with reviewed cases required for each reviewed district, probes the registry-scoped HTTP parking-answer API path for reviewed packs, then writes and validates a district-scoped release package only after those prerequisite checks pass. The markdown report prints the release ID, zip path, manifest path, districts, file count, and total bytes for handoff. The current reviewed release set is all 12 Taipei districts. Use `npm run ops:package-release:reviewed` and `npm run ops:validate-release-package:reviewed` when you only need the reviewed release archive and validation report; those shortcuts discover the same reviewed district set from answer-case files instead of hard-coding district ids. The `Release Data Package` workflow also runs reviewed UI answer smoke in LIST and MAP modes before this release gate, so published release assets are checked against the front-end answer flow as well as data/API gates.
  Fresh official sources can change the content-addressed dataset hash without changing a reviewed answer. After release ingest, the workflow runs `npm run ops:refresh-reviewed-case-hashes -- --execute`; it temporarily ignores the old hash only while rerunning every exact reviewed assertion, updates only `datasetHash` when all districts preserve answer/evidence/primary-segment semantics, and writes `.tmp/reviewed-answer-case-repin.md/json`. One semantic failure blocks every hash write and the release.
  Manual workflow dispatches keep answer-case review fallback disabled by default. When the source QA CSVs are intentionally not stored in the repository, dispatch with `allowAnswerCaseReviewFallback=true` or run `npm run ops:release-data-dispatch -- --repo <owner/repo> --ref <branch> --allow-answer-case-review-fallback true`; the district matrix may then use committed reviewed answer cases as review evidence, while the same release gate still requires exact generated-pack and parking-answer API smokes for every reviewed district.
- Deploy readiness gate for the reviewed release package:
  `npm run ops:release-handoff-readiness`
  This runs build, P3 release readiness, deploy readiness, and Render deployment handoff sequentially, then fails if the P3, deploy, and handoff JSON files do not point at the same release ID. The deploy readiness gate installs the latest `dist/releases` zip/manifest pair into `.tmp/deploy-readiness/public/data/generated`, verifies the built `dist/data/generated` registry and per-district `LATEST.json` hashes match that installed release, runs reviewed generated-pack and parking-answer API smokes against the installed release root, then starts the production app server against the same installed release root. The app-server smoke verifies `/api/parking-answer/ready` exposes per-district dataset hashes for post-deploy verification, probes the mounted same-origin geocode, route, sync, and parking-answer health/ready endpoints, and runs a sync issue-report roundtrip before the app server is accepted. It writes `.tmp/deploy-readiness.md` and `.tmp/deploy-readiness.json` for release handoff artifacts. Use this before assigning release asset URLs to Render so stale `dist` assets, bad package installs, release ID mismatches, or same-origin API readiness failures are caught locally.
- Render deployment handoff from the current release artifacts:
  `npm run ops:render-deployment-handoff`
  This reads `.tmp/p3-release-readiness.json` and `.tmp/deploy-readiness.json`, verifies both gates point at the same passing release, copies the exact zip/manifest into `.tmp/release-handoff-assets/<releaseId>/`, then writes `.tmp/render-deployment-handoff.md` and `.tmp/render-deployment-handoff.json` with the exact GitHub Release asset URLs, copied local asset paths, Render env vars, and expected per-district dataset hashes. The release manifest also carries the same district dataset-hash contract. The local preview URLs become live only when the same release ID is published; if `Release Data Package` generates a fresh release ID, use the URLs printed by that workflow summary or uploaded handoff artifact instead.
- Release handoff status:
  `npm run ops:release-handoff-status`
  This reads the local handoff artifacts, checks that copied local release assets still exist, checks whether the expected GitHub Release tag has already been published, and prints the exact local handoff, release dispatch, tag-push release workflow fallback, Render env sync, and Render live-verify commands. Pass `--app-url` or set `PARKKING_RENDER_APP_URL` to render the final live verification command with a real Render service URL. When the release is already published, the first Render env sync command uses `--service-id "<Render service ID>"` so the handoff env plan can be previewed without resolving `parkking` through the Render API; the `--service-name parkking` variant remains available when `RENDER_API_KEY` is set. Default `data-*` tags are workflow-managed: creating one triggers Release Data Package, which re-ingests sources and owns the final assets. Do not manually create the GitHub Release or upload local handoff assets to that tag. Dispatch the workflow or push the printed tag, wait for completion, then use the workflow's uploaded handoff and published manifest as the authoritative Render contract.
- Release publish request handoff:
  `npm run ops:release-publish-request -- --ref main --app-url https://<service>.onrender.com`
  This writes `.tmp/release-publish-request.md` and `.tmp/release-publish-request.json` from the current handoff. The request includes the resolved target SHA, exact local zip/manifest paths and checksums for preflight comparison, token/CLI availability, the GitHub Actions dispatch and tag-push paths, Render environment variables, Render env sync commands, and final verification commands. For workflow-managed `data-*` tags it explicitly blocks manual/local asset publishing and directs operators to consume the completed workflow artifact instead.
- Production rollout status:
  `npm run ops:production-rollout-status -- --ref main --app-url https://<service>.onrender.com`
  This writes `.tmp/production-rollout-status.md` and `.tmp/production-rollout-status.json`, combining release handoff status, publish-request credential availability, Render env sync commands, and next actions into one operator-facing decision report. Add `--check-live` to run live Render verification and distinguish `READY_FOR_LIVE_VERIFY` from `NEEDS_RENDER_ENV_SYNC`; add `--require-live-pass` when a gate should fail unless the deployed service actually matches the release package and runtime hardening checks. In GitHub Actions or another environment without `.tmp/render-deployment-handoff.json`, pass `--manifest-url <published manifest URL>` and optionally `--package-url <published package URL>`; the package URL is inferred for standard release asset filenames. The same report is available as the manual `Production Rollout Status` workflow, which also uploads `.tmp/render-dashboard-env-packet.md/json` for Render Dashboard updates, or from CLI with `npm run ops:production-rollout-status-dispatch -- --repo <owner/repo> --ref main --app-url https://<service>.onrender.com --manifest-url <published manifest URL> --dry-run`.
- Published release URL smoke:
  `npm run ops:release-data-url-smoke`
  This checks the package URL with `HEAD`, falls back to `GET` with `Range: bytes=0-0` when `HEAD` is rejected, fetches the manifest URL, and verifies the manifest `releaseId` matches the release being handed to Render. The `Release Data Package` workflow runs it immediately after publishing GitHub Release assets.
- Live Render deployment verification:
  `npm run ops:render-deployment-verify -- --app-url https://<service>.onrender.com --manifest-url <PARKKING_RELEASE_MANIFEST_URL> --all-parking-answer-cases`
  This reads the release manifest dataset-hash contract, fetches `/api/parking-answer/ready`, and fails if the live service is missing a reviewed district, reports it as not ready, or serves a dataset hash different from the released package. With `--all-parking-answer-cases`, it sequentially verifies every reviewed answer case; without the flag, local diagnostics use the first case per district. It also probes the live same-origin geocode, route, sync, and parking-answer health/ready endpoints, verifies geocoder/routing readiness exposes positive upstream request timeouts, runs a sync issue-report roundtrip, and verifies that sync CORS rejects an untrusted browser origin instead of returning wildcard access. If live dataset hashes differ from the release contract, the markdown and JSON reports include a release-package remediation block with the exact Render package/manifest env vars, full build/redeploy steps, and follow-up verify command. If sync CORS or proxy timeout checks fail, the reports include a runtime remediation block with the exact Render env vars, redeploy steps, and follow-up verify command. The same check is available as the manual `Render Live Verify` GitHub Actions workflow by passing the Render app URL and published manifest URL; enable `useGithubToken` only for private GitHub Release asset URLs from this repository, leave `skipSyncIssueRoundtrip` false unless the live environment intentionally rejects sync smoke writes, and keep `allParkingAnswerCases` true for release acceptance. When verifying locally from the same checkout that generated the handoff, the command can use `.tmp/render-deployment-handoff.json` instead of `--manifest-url`.
- Render runtime env sync:
  `npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --handoff-json .tmp/render-deployment-handoff.json`
  This previews the required production runtime hardening env vars and, when `--handoff-json` is present, the release package URL env vars from the reviewed handoff. Service-id dry-runs do not need a Render token. To apply, set `RENDER_API_KEY` and rerun with `--execute --deploy`; use `--service-name parkking` only when you need the tool to resolve the service ID through the Render API. You can also pass `--package-url` and `--manifest-url` explicitly. The same operation is available as the manual `Render Runtime Env Sync` GitHub Actions workflow when `RENDER_API_KEY` is configured as a repository secret; add `PARKKING_RENDER_SERVICE_ID` as a repository secret for the automatic `data-*` tag sync path so it can deploy without service-name lookup. The workflow is dry-run by default and requires `execute=true` to modify Render. Dispatch it from CLI with `npm run ops:render-runtime-env-sync-dispatch -- --repo <owner/repo> --ref main --handoff-json .tmp/render-deployment-handoff.json --dry-run`, then rerun without `--dry-run` and with `--execute` when `GH_TOKEN` or `GITHUB_TOKEN` is set.
- Render dashboard env packet:
  `npm run ops:render-dashboard-env-packet -- --app-url https://<service>.onrender.com`
  This writes `.tmp/render-dashboard-env-packet.md` and `.tmp/render-dashboard-env-packet.json` with exact Render Dashboard key/value rows, a PowerShell export preview, manual deploy checklist, and follow-up verification commands. It does not require a Render service ID or API token. By default it reads `.tmp/production-rollout-handoff.json` when present, then `.tmp/render-deployment-handoff.json`; pass `--package-url` and `--manifest-url` when only published release URLs are available.
- Render Blueprint contract check:
  `npm run ops:render-blueprint-check`
  This fails if `render.yaml` loses the release package install build step, same-origin parking-answer health check, required Render environment variables, or the explicit non-wildcard sync CORS origin. CI, publish, and release-data workflows run the same check before release/deploy gates.
- Registry-scoped UI smoke check for reviewed generated packs:
  `npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --timeout-ms 25000`
  Add `--view MAP --limit 1` when you want the same reviewed-pack discovery path to exercise map/list mode instead of list mode:
  `npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --view MAP --limit 1 --timeout-ms 25000`
- Static validation for committed reviewed answer-case files:
  `npm run ops:validate-answer-cases`
- Query one exact coordinate for a parking answer:
  `npm run ops:query-parking-answer -- --datasetDir public/data/generated/xinyi --lng 121.57465611063279 --lat 25.032494081749498 --hhmm 21:00 --radius 20`

The exact smoke checks that real evaluated segments can produce pinned-location `PARK` and
`NO_STOP` answers, plus a marked-space-backed `PARK` answer when the pack has official parking
space evidence. Xinyi also has reviewed golden cases in `configs/prod/xinyi.answer-cases.json`;
those pin the current reviewed LEGAL / ILLEGAL answers to exact coordinates, expected answer
kinds, primary segment ids, and marked-space evidence. On failure it prints the observed counts,
sampled answers, and any failed pinned cases. The
generated-pack smoke wrapper scans `<root>/*/dataset_meta.json`, or the districts listed in
`--registry <root>/registry.json` / `--report <root>/ingest_all_report_dry.json` when provided,
fails if no generated packs exist, and runs both bulk and exact answer smoke for each discovered
district. Use
`--use-reviewed-cases --reviewed` for publish-mode validation so reviewed/published districts
discovered from `configs/prod/*.answer-cases.json` cannot ship without reviewed pinned cases.
The HTTP API smoke starts the same parking-answer service used by Vite dev/preview and probes
`/health` plus `/ready` before answer requests. With reviewed cases it verifies exact coordinates,
expected answer kind, evidence kind, primary segment, final confidence, parking-space count, and
dataset hash. With `--no-cases` it derives sample query points from the generated pack first, then
verifies the service returns the same answer through HTTP; CI uses this mode after fixture ingest so
the API path is covered without depending on local review artifacts. Use `--skip-health-check` only
when debugging a custom endpoint that intentionally does not expose the ParkKing probe routes.
Use `ops:smoke-parking-answer-apis` for registry/report-scoped multi-district API smoke; it reuses
the same reviewed-case and fixture-threshold semantics as generated-pack smoke, but verifies the
HTTP service path for each discovered generated pack instead of only one district.
When `<root>/registry.json` exists and no `--registry` / `--report` is provided, the wrapper uses
that registry by default because it matches runtime loading and ignores stale unpublished district
directories. Use `--all-dirs` when you intentionally want to scan every generated directory under
the root, including stale packs.
Use `ops:generated-pack-inventory` before expanding beyond Xinyi to see which generated folders are
actually published by `registry.json`, which folders are stale/unpublished, and whether MVP-critical
layers such as `parking_spaces.geojson`, `candidates_inferred.geojson`, and `sign_overrides.geojson`
are present. The command is report-only by default; `--strict` turns warnings into a non-zero exit.
Use `ops:district-readiness-matrix` when comparing Xinyi, Daan, Zhongshan, or future districts: it
loads `configs/prod/*.json`, runtime registry state, optional `data/generated` dry-run packs, and
`.tmp/<district>-review*.csv` review files, then reports the layer that still blocks publish.
Use `ops:human-review-index` before sending Daan, Zhongshan, or future review packets to a human:
it scans `.tmp/*-human-review`, verifies each bundle has the source CSV, manifest, checklist,
GeoJSON, and handoff CSV, then prints the remaining P0 review requirements plus the exact finalize
command to run after `reviewStatus`, `reviewNote`, and `createdAt` are filled from observed evidence.
The same index identifies source-text-only review contracts separately, reports their latest
dedicated status snapshot, and prints their own gate instead of inventing missing P0 QA artifacts.
`createdAt` / `reviewedAt` must be an ISO timestamp with timezone, for example
`2026-05-22T12:00:00.000Z`.
Use `ops:package-human-reviews -- --district <ids>` to create zip handoff packets under
`.tmp/human-review-packages` for bundles that are still `ready-for-review`; it skips bundles that
are already ready to finalize and requires `--district` or `--all` so scratch bundles are not
packaged accidentally. Area-scoped bundles use their bundle id for the zip filename and archive
root while retaining the owning district id for validation/finalize commands, so `shipai` and
`beitou` can be packaged together without overwriting or sharing the wrong audit. Each packet
includes `review/handoff-audit.md/json` plus
`review/priority-review.md/csv/json` so the reviewer can start from the minimum row-level issues
and priority rows without running local tooling first.
Combined returned CSVs are scoped by `bundleId`; an area alias remains supplemental evidence and
waits for parent-district consolidation instead of invoking the parent validator or finalizer
independently.
If the reviewer fills `reviewStatus`, `reviewNote`, and `createdAt` in a single-district
`priority-review.csv`, it can be used as the `--reviews` input to `ops:apply-qa-review` or the
printed finalize command; multi-district priority exports are guides and should be split per
district before applying. If only `priority-review.csv` is filled, do not run the full handoff
finalize command for `<district>-next-review.csv`; run `ops:p0-validate-priority-review` first and
use the finalize command it prints after validation passes.
Use `ops:p0-validate-priority-review -- --district <id> --reviews <priority-review.csv>` when a
filled priority CSV returns from review: it filters multi-district priority exports down to the
selected district, writes `.tmp/<district>-priority-review.filtered.csv`, applies it to the source
review CSV, runs the same P0 review gate as promotion, writes overrides under `.tmp`, and prints the
exact `ops:p0-finalize-review` command only when the evidence is gate-ready.
Use `ops:p0-review-intake -- --district <ids> --include-common-dirs` before trusting a returned
review packet: it scans `.tmp`, Desktop, and Downloads for matching CSVs, counts valid reviewed
rows, ignores package metadata columns such as `status=ready-for-review`, and prints validate
commands only for files that actually contain `reviewStatus`, `reviewNote`, and `createdAt`.
Add `--validate-ready` to run the same priority-review validation immediately for those ready
files; it still fails closed when evidence is missing and only prints finalize commands after the
P0 gate passes.
Use `ops:review-handoff-audit -- --district <ids>` after a human starts filling the handoff CSV:
it reports row-level missing `reviewStatus`, `reviewNote`, `createdAt`, identity, and invalid
status/timestamp issues before finalize. Add `--priority-out`, `--priority-csv-out`, or `--priority-json-out`
to write a compact reviewer guide containing only the first required priority rows. Add `--strict`
to make the command exit non-zero while any handoff row is still pending or invalid.
Use `ops:p0-advance-reviews -- --district <ids>` when you want the safest one-command next step:
it audits and packages `ready-for-review` bundles, prints finalize commands for
`ready-to-finalize` bundles, and only runs finalize when `--execute` is passed. It never fills
review evidence or publishes a bundle whose handoff CSV still lacks valid human-reviewed rows.
Add `--review-intake --include-common-dirs` to the same command when you want it to first scan
`.tmp`, Desktop, and Downloads for returned reviewer CSVs before packaging another handoff. Add
`--validate-ready` when returned files should be gate-validated during that same dry-run. When
`--require-ready-to-finalize` is combined with `--review-intake --validate-ready`, a returned
priority CSV that passes validation counts as ready and the command skips repackaging that district.
With `--execute`, those validated returned priority rows are finalized through the same P0 workflow
using the filtered single-district review CSV written by validation.
Use `ops:p0-review-gate -- --district <ids>` for the strict release/CI form of the same flow:
it always scans common return locations, validates ready priority review files, and exits non-zero
until every selected district is ready to finalize or already review-complete. It uses `--no-package`
so failed gates do not create another handoff zip; run `ops:p0-advance-reviews` when a fresh human
review package is needed. Use `ops:p0-review-gate-report` when CI should upload the same blocked
report as an artifact without failing the unrelated build.
`ready-for-review` means the handoff rows still need human evidence. `ready-to-finalize` means the
handoff CSV itself has enough valid reviewed rows for the configured P0 thresholds and can be passed
to the printed `ops:p0-finalize-review` command.
Use `--require-ready-to-finalize` when you want the command to fail until every selected district is
either `ready-to-finalize` or already `review-complete`.
After review, prefer `ops:p0-finalize-ready-reviews -- --district <ids>` as the final preflight:
without `--execute` it only prints the exact `ops:p0-finalize-review` commands for ready districts
and fails when none are ready; with `--execute` it runs the same finalize workflow for ready bundles
only. The command requires `--district` or `--all` so old scratch bundles under `.tmp` are not
finalized accidentally.
By default it also reads `data/generated/_ops/publish_gate_summary.json`; if the only current WARN
for a district is `BASELINE_MISSING`, the generated finalize command includes a scoped
`--allow-publish-warn --publish-override` first-publish bootstrap reason.
In GitHub Actions, the generated-pack and reviewed-UI smoke wrappers append to
`GITHUB_STEP_SUMMARY` automatically when `--summary` is omitted.
single-coordinate query reports the nearest mapped segment, action (`PARK`, `TEMP_STOP`, or
`NO_STOP`), confidence, evidence, caveats, and triggered reasons. Use `--include-inferred` when
you want inferred candidate curbs to be eligible for the answer.
The UI smoke starts a temporary Vite preview, drives headless Chrome through CDP, and checks that
each reviewed answer case renders the pinned answer card, decision copy, confidence, evidence
type, and no-route-ranked-results fallback. It requires Chrome plus Node 22+ for the built-in
WebSocket client; GitHub workflows run Node 24, and the publish workflow runs this gate for any
generated district with a matching `configs/prod/<districtId>.answer-cases.json` file.
The MAP-mode UI smoke uses the same Chrome/CDP path against `?dataset=<district>&view=MAP`, reads
runtime `dataset_meta.json`, and fails if dataset status never reaches ready, the map component
does not receive the metadata-backed feature counts, the reported UI counts stay empty, the map
panel text, legend, `.map-root`, or `.maplibregl-canvas` are missing, or the map fallback renders.
This catches lazy-loaded map bundle, dataset-loading, and WebGL regressions that the answer-card UI
smoke cannot see.
`ops:smoke-reviewed-ui-packs` scopes that UI gate to generated districts from `--registry` or
`--report`, so stale generated directories do not create false workflow inputs.
For the districts discovered from `configs/prod/*.answer-cases.json`, reviewed answer cases are
required in the publish workflow; publishing one of those generated packs without
`configs/prod/<districtId>.answer-cases.json` fails before release packaging. Reviewed
answer-case files must include `datasetHash` by default, and both exact-answer and UI smoke fail
when that hash does not match the runtime `dataset_meta.json`; use `--allow-unpinned-cases` only for
local debugging. CI also runs `ops:validate-answer-cases`, which checks committed reviewed case
files for `datasetHash`, district/file-name consistency, duplicate ids, UI-compatible times, exact
primary segment pins, evidence kind, and final confidence. CI, nightly, publish, and ingest-dry-run
workflows now also run parking-answer API smoke plus same-origin API service probes so geocode,
routing, sync, and parking-answer `/health` and `/ready` routes are exercised before merge or
release. Those gates also run the sync issue-report write/read roundtrip, so the production
feedback capture endpoint is exercised before merge or release.

`datasetHash` is content-addressed from the district boundary and runtime GeoJSON layers. Metadata
also records `datasetSourceHash` and `generatorHash`: review gates compare those values against the
current source/config inputs and transitive ingest implementation, while release, runtime cache,
and reviewed-answer pins use the content hash. Volatile reports such as
`intersections_report.json.generatedAt` do not participate in dataset identity.

CI, nightly, and publish use
`--start-preview` after build to verify the actual Vite-mounted routes, and they run
`ops:bundle-budget` after production build so heavy map/geospatial chunks stay off the initial
preload path; ingest dry-run uses the
standalone probes against the dry-run dataset root.

To refresh reviewed golden cases from a merged QA review CSV:
`npm run ops:write-answer-cases -- --input .tmp/<districtId>-review.merged.csv --dataset-dir public/data/generated/<districtId> --out configs/prod/<districtId>.answer-cases.json`

## Multi-district Ops

Run the same pipeline across many districts by using a config glob:

`npm run ingest:all -- --configs "configs/prod/*.json"`

The ingest resolver only runs JSON files with an ingest `inputs` section, so reviewed answer-case
sidecars such as `configs/prod/xinyi.answer-cases.json` can live beside prod configs without being
treated as ingest configs.
Publishing a subset of districts updates those districts in `registry.json` while preserving other
already-published registry entries; use `ops:generated-pack-inventory` after subset publishes to
confirm runtime registry state.

If you need to preflight all configs:

`npm run ops:validate-configs`

The pipeline writes aggregated reports to:
- `data/generated/ingest_all_report.json`
- `public/data/generated/ingest_all_report.json`

## Real Sources

Use `ops/sources.prod.example.json` as a template for production source manifests.
Each source item tracks the download URL, destination path, checksum, and optional notes.

Run:
- `npm run ops:fetch-sources -- --manifest ops/sources.prod.example.json`
- `npm run ops:fetch-sources -- --manifest ops/sources.prod.example.json --dryRun` (preview only)
- `npm run ops:fetch-sources -- --manifest configs/sources.prod.taipei.json`
- `npm run ops:unpack-sources -- --sourceDir data/sources/shared`

The publish workflow runs the Taipei source fetch/unpack steps automatically when
`configsGlob` starts with `configs/prod/` so hosted runners do not depend on
ignored local `data/sources` files.

`ops:fetch-sources` writes per-district provenance to:
- `data/sources/<districtId>/provenance.json`

Raw inputs should be stored under:
- `data/raw/<districtId>/...`

## CI Fixtures

To rebuild the CI fixture pack:

`npm run ingest:all -- --configs "configs/ci-fixtures.json" --allowWarn --override "ci"`

## QA Sampling

Generate manual QA candidates from the latest district pack or generated folder:

- `npm run ops:sample-qa -- --district xinyi --topN 50 --riskMode Neutral --radius 600`
- `npm run ops:sample-qa -- --district xinyi --strategy review --hhmm 21:00 --radius 5000 --topN 80 --out .tmp/xinyi-review.csv`
- `npm run ops:sample-qa -- --district songshan --strategy review --config-root configs/expansion --out .tmp/songshan-review.csv`
- `npm run ops:sample-qa -- --district songshan --strategy review --config-root configs/expansion --include-segment candidate-8529-1-L --out .tmp/songshan-review.csv` (pins the requested segment family and all evaluated `part-*` rows)
- `npm run ops:sample-qa -- --district beitou --strategy review --config-root configs/expansion --anchor-lat 25.114 --anchor-lng 121.515 --radius 1500 --out .tmp/shipai-review.csv` (centers ranking and radius filtering on Shipai)
- `npm run ops:sample-qa -- --all --topN 50`

Default output path:
- `public/data/generated/<districtId>/qa_candidates.csv`
- `public/data/generated/<districtId>/qa_candidates.manifest.json`
- `public/data/generated/<districtId>/qa_candidates.review.md`

The manifest is written next to the CSV by default. It records sampling params, dataset hash/config hash, source pack directory, bucket counts, reason counts, and the exact follow-up `ops:qa-review-summary` / `ops:qa-review-gate` commands. Use `--manifestOut <path>` to place it elsewhere; `--all` supports `{districtId}` and `<id>` placeholders. Use `--config-root configs/expansion` for expansion packets that should gate against candidate configs instead of `configs/prod`.
The review doc is also written next to the CSV by default. It groups candidates by `reviewBucket`, includes map and Street View links, and leaves verdict/notes blanks for human review. Use `--reviewDocOut <path>` to place it elsewhere.
`ops:qa-review-summary` auto-loads the adjacent `.manifest.json` when present, or accepts `--manifest <path>`, so gate output shows the reviewed packet's dataset hash and config hash. Add `--strict-manifest` when you want summary to fail on stale manifest pointers or row-count mismatches, `--strict-reviewed-rows` when invalid reviewed rows should fail instead of warn, and `--strict-reviewed-segments` when duplicate/conflicting segment reviews should fail instead of warn. Use repeated `--min-reviewed-bucket bucket=count` flags, or comma-separated pairs, to require minimum reviewed coverage for specific QA buckets. Summary and gate output also list unmet review requirements, a minimum review plan, and the next pending rows to review; tune that handoff with `--next-review-limit` and write a focused handoff CSV with `--next-review-out <path>`.
Use `npm run ops:p0-readiness` for a one-command Xinyi P0 status check. It combines exact answer smoke, reviewed answer golden cases, strict QA review summary, review packet provenance, current config drift, and publish gate state into a single blocked/pass report without exporting overrides or bypassing any gate.
Use `npm run ops:p0-prepare-review` to regenerate the current Xinyi reviewer packet in one step. It writes the focused handoff CSV, checklist markdown, and GeoJSON review layer, but it does not export sign overrides or choose `LEGAL` / `ILLEGAL` / `UNCLEAR`.

Suggested manual review loop:
1. Generate a `--strategy review` packet when collecting sign overrides. It round-robins across buckets such as marked-space park, no-stop, temporary-stop, inferred, stale-data, and zone-restricted candidates instead of only taking the top-ranked rows.
2. Open candidate rows from the `.review.md` checklist or CSV in Street View / map imagery. Use `streetViewUrl` for direct pano review and `reviewBucket` to understand why a row was sampled.
3. Record verdicts either in the in-app report flow or directly in the CSV `reviewStatus` column (`LEGAL`, `ILLEGAL`, or `UNCLEAR`), with `reviewNote` and `createdAt` filled from observed evidence. `createdAt` / `reviewedAt` must be an ISO timestamp with timezone, for example `2026-05-22T12:00:00.000Z`.
4. Gate the reviewed CSV before ingest. This runs review summary, exports JSONL overrides, and preflights segment ids in one step:
   - `npm run ops:qa-review-gate -- --input .tmp/xinyi-review.csv --config configs/prod/xinyi.json --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park --min-reviewed-bucket marked_space_park=2 --min-reviewed-bucket no_stop=2 --next-review-limit 10 --next-review-out .tmp/xinyi-next-review.csv`
   - Run the gate without `--outDir` when you want ingest to consume the result directly; the default output is `data/overrides/<districtId>.jsonl`, which is the path `ingestSignOverrides` reads.
   - CSV gate runs in strict manifest mode by default: if an adjacent or explicit manifest points at another CSV, has invalid JSON, records a different row total, targets another district, or carries a stale config/dataset hash, the gate fails before exporting overrides. Use `--allow-manifest-warnings` only for legacy CSVs after manually verifying provenance.
   - `--allow-config-provenance-warnings` downgrades config/dataset hash mismatch to warnings while still enforcing district identity and segment-id preflight. Reserve it for known non-data config changes such as ops/validation threshold edits.
   - Gate also fails before export when any reviewed CSV/report row has an invalid status, missing identity, missing evidence fields (`reviewNote` / `createdAt`), or an invalid `createdAt` timestamp. Use `--allow-invalid-reviewed-rows` only for legacy data after confirming those rows should be ignored.
   - Gate fails before export when multiple reviewed CSV/report rows resolve to the same `districtId+segmentId`, including `-part-N` segment ids that collapse during export. Use `--allow-duplicate-reviewed-segments` only after manually resolving conflicts and accepting latest-verdict collapse semantics.
   - Bucket minimums require QA CSV input because report JSON/JSONL does not carry `reviewBucket`.
   - In-app report exports can also be passed as JSON/JSONL report input, but bucket coverage checks require the QA CSV because report JSON does not carry `reviewBucket`.
5. If the gate writes a focused handoff CSV with `--next-review-out`, fill that file's `reviewStatus` values and merge it back into the source QA CSV instead of editing generated overrides by hand:
   - One-command reviewer packet: `npm run ops:p0-prepare-review`
   - Optional reviewer checklist: `npm run ops:qa-review-checklist -- --input .tmp/xinyi-next-review.csv --source .tmp/xinyi-review.csv --out .tmp/xinyi-next-review.md --merged-out .tmp/xinyi-review.merged.csv --config configs/prod/xinyi.json --title "Xinyi gate-critical rows"`
   - The checklist is read-only: it repeats provenance hashes, segment ids, bucket reasons, map links, and the apply/gate commands, but it does not choose `LEGAL` / `ILLEGAL` / `UNCLEAR`.
   - Optional review map layer: `npm run ops:qa-review-geojson -- --input .tmp/xinyi-next-review.csv --out .tmp/xinyi-next-review.geojson`
   - After the handoff CSV has real reviewed rows, use the one-command P0 closure: `npm run ops:p0-finalize-review -- --district xinyi`. It applies the handoff, gates the merged CSV with the Xinyi P0 thresholds, rebuilds the district pack, refreshes `ingest_all_report.json`, regenerates reviewed answer cases, and reruns readiness against `.tmp/xinyi-review.merged.csv`.
   - For manual debugging, run `npm run ops:apply-qa-review -- --source .tmp/xinyi-review.csv --reviews .tmp/xinyi-next-review.csv --out .tmp/xinyi-review.merged.csv`
   - Then rerun the gate using the merged CSV: `npm run ops:qa-review-gate -- --input .tmp/xinyi-review.merged.csv --config configs/prod/xinyi.json --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park --min-reviewed-bucket marked_space_park=2 --min-reviewed-bucket no_stop=2`
   - Lower-level shortcut after the handoff CSV has real reviewed rows: `npm run ops:p0-promote-review`. It applies the handoff, gates the merged CSV with the Xinyi P0 thresholds, and fails before export when `reviewStatus` is still blank.
   - New handoff CSVs include `topReasons`, `flags`, `sourceDatasetHash`, `sourceConfigHash`, `sourceRowsTotal`, `reviewPlanRank`, and `reviewPlanReason`; `ops:apply-qa-review` verifies provenance values against the source CSV's adjacent `.manifest.json` before writing the merged CSV.
   - On success, `ops:apply-qa-review` also writes `.tmp/xinyi-review.merged.manifest.json` with the same dataset/config provenance, updated `csvPath`, updated review status counts, and apply metadata so the next gate can still detect stale packets.
   - Sort or filter by `reviewPlanRank` when you only want to fill the current gate-critical rows first. The plan ranks bucket coverage, but `LEGAL` / `ILLEGAL` status coverage must still come from the observed curb/sign evidence.
   - `ops:apply-qa-review` refuses blank handoff packets, invalid statuses, missing `reviewNote` / `createdAt`, invalid `createdAt` timestamps, duplicate `sourceRowNumber` values, stale provenance, identity mismatches, bucket mismatches, and overwrites unless `--allow-overwrite` is explicitly set.
6. For lower-level debugging, the gate is equivalent to running:
   - `npm run ops:qa-review-summary -- --input .tmp/xinyi-review.csv --min-reviewed 1 --require-status LEGAL --require-status ILLEGAL --require-bucket marked_space_park --min-reviewed-bucket marked_space_park=2 --min-reviewed-bucket no_stop=2 --next-review-limit 10 --next-review-out .tmp/xinyi-next-review.csv`
   - `npm run ops:apply-qa-review -- --source .tmp/xinyi-review.csv --reviews .tmp/xinyi-next-review.csv --out .tmp/xinyi-review.merged.csv`
   - `npm run ops:export-overrides -- --input <reports.jsonl-or-json-or-qa-review.csv>`
   - `npm run ops:preflight-sign-overrides -- --config configs/prod/xinyi.json`
   - `npm run ops:preflight-sign-overrides -- --config configs/prod/xinyi.json --json --out .tmp/xinyi-override-preflight.json`
7. Reviewed CSV/report rows with invalid `reviewStatus`, missing `districtId`, missing `segmentId`, missing `reviewNote` / `createdAt`, invalid `createdAt` timestamps, or duplicate reviewed segment keys fail fast instead of being silently dropped or collapsed.
8. Fix any `Missing segment ids` before shipping user-reported overrides into the pack. User-report overrides now fail closed when the named segment id no longer exists; they will not silently rematch by distance.
9. For Xinyi P0, prefer `npm run ops:p0-finalize-review -- --district xinyi` after review. For other districts or manual debugging, ingest again (`npm run ingest:all -- --configs "configs/prod/<districtId>.json"`), refresh the publish report, then run readiness against the merged reviewed CSV.

Set `PARKKING_OVERRIDE_REPORTS_DIR=<dir>` when a fixture or isolated ingest must not consume the
default `data/overrides/<districtId>.jsonl` reviewed override files. CI fixture workflows point this
to `.tmp/ci-overrides` so production Xinyi override reports cannot leak into tiny fixture packs.

## Pack Diff Reports

Each publish writes a `diff_report.json` into the published pack directory:
- `public/data/generated/<districtId>/diff_report.json`

The publish gate consumes this report (or computes one) to flag suspicious deltas.
Set `PARKKING_GATE_STRICT=1` to escalate diff WARN rules (segments delta, coverage drops, overrides ratio)
into FAILs in CI.

Run locally:
- `npm run ops:diff-packs -- --prev <path> --next <path>`
- `npm run ops:diff-packs -- --next <path> --format md`

## Publish Gate Summaries

Each ingest publish-gate run now writes both machine-readable and human-readable summaries:
- `public/data/generated/_ops/publish_gate_summary.json`
- `public/data/generated/_ops/publish_gate_summary.md`

Dry-run ingest writes the same pair under:
- `data/generated/_ops/publish_gate_summary.json`
- `data/generated/_ops/publish_gate_summary.md`

The markdown summary includes:
- gate mode and exit code
- INFO / WARN / FAIL totals
- per-district top WARN / FAIL codes
- sign-override breakdown per district: direct matches, spatial fallback matches, unmatched named overrides
- bootstrap / baseline-adopt decisions when used

`PERF_REGRESSION` compares evaluation wall-clock time with the reviewed baseline,
but baseline generation and release gates can run on different hosts. Until
benchmark records include a comparable host fingerprint, this signal remains a
WARN that requires the normal publish WARN override; it does not become a hard
FAIL. Data-count, distribution, reason-code, dataset-hash, answer-correctness,
and bundle-budget failures remain hard gates.

These workflow runs now append that markdown summary into the run summary and upload it as a downloadable artifact:
- `.github/workflows/publish.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/ingest_dry_run.yml`

Workflow issue triage artifacts use `ops:refresh-workflow-issue-artifacts` after artifact upload.
That wrapper refreshes packet/CSV artifact URLs, rebuilds `artifact-index.json`,
`index-summary.json`, `index-surface.json`, and `index-summary.md`, and avoids multi-command shell
blocks in the workflow YAML.

The publish workflow also passes any reviewed answer case file at
`configs/prod/<districtId>.answer-cases.json` into `ops:smoke-generated-packs` for exact parking
answer smoke. For Xinyi, that means a release fails if the reviewed pinned answers drift from the
published pack, if the case file is not pinned to a `datasetHash`, or if publish ingest produces no
generated district packs.

## Metrics History

Each publish appends a line to:
- `public/data/generated/<districtId>/metrics_history.jsonl`

History is capped to the most recent 180 entries per district.

To generate manually:
- `npm run ops:write-metrics-history -- --pack <path> --prevPack <path>`

## Health Deltas

Dataset Health shows “Since last publish” deltas for segments, overrides, and coverage rates.
These are derived from `metrics_history.jsonl` when available.

Dataset meta and Dataset Health now also surface sign-override match quality:
- `signOverrideMatchedSegmentCount`
- `signOverrideSpatialMatchCount`
- `signOverrideUnmatchedNamedCount`

If `signOverrideUnmatchedNamedCount` is non-zero, the UI warns that named overrides did not
match current segments. Use `ops:preflight-sign-overrides` before ingesting exported reports.
For workflow or multi-config checks, use the batch wrapper so config globbing happens in Node
instead of shell:
- `npm run ops:preflight-sign-overrides:batch -- --configs "configs/prod/*.json" --out-dir .tmp/sign-override-preflight`

## Nightly Notifications

The nightly workflow posts a GitHub issue or comment when diff reports include WARN/FAIL
districts, when the current publish-gate summary still carries WARN/FAIL totals, or when synced
user issue reports exist. The issue/comment now includes:
- a compact publish-gate summary with top publish-gate districts
- diff WARN/FAIL districts
- synced user issue hotspots
- links to downloadable publish-gate and issue-triage artifacts, including the packet root,
  packet root URL, packet `manifest.json` preferred portable input, and preferred CSV join file

Manual run:
- `npm run ops:notify-nightly-from-registry -- --registry public/data/generated/registry.json --root public/data/generated`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId>/diff_report.json`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId>`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId> --issue-limit 5`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId> --issue-input .tmp/issue-report-artifacts/manifest.json`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId> --issue-input .tmp/issue-report-artifacts/index-summary.json`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId> --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json`

## Issue Report Triage

Detailed runbook:
- `docs/issue-report-triage.md`

### Manual summary CLI

Summarize synced issue reports from the local sync store:

- `npm run ops:issue-report-summary -- --scope alpha`
- `npm run ops:issue-report-summary -- --district xinyi --since 2026-04-02`
- `npm run ops:issue-report-summary -- --segment seg-1 --reason TIME_WINDOW`
- `npm run ops:issue-report-summary -- --district xinyi --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json`
- `npm run ops:issue-report-summary -- --out .tmp/issue-summary.md`
- `npm run ops:issue-report-summary -- --json --out .tmp/issue-summary.json`
- `npm run ops:issue-report-summary -- --json --out .tmp/issue-summary.json --summary-base-url https://example.com/issue-summary`
- `npm run ops:issue-report-summary -- --raw-out .tmp/raw-issues.json`
- `npm run ops:issue-report-summary -- --raw-out .tmp/raw-issues.json --raw-base-url https://example.com/raw-issues`
- `npm run ops:issue-report-summary -- --csv-out .tmp/issue-csv --csv-root-url https://example.com/issue-csv`
- `npm run ops:issue-report-summary -- --packet-out .tmp/issue-packets --packet-root-url https://example.com/issue-packets`

This CLI supports:
- `--scope`
- `--publish-gate-summary`

When you save a human-readable summary with `--out`, the rendered markdown now appends an
`Artifact handoff` block that spells out the `Input surface`, `Canonical full-index handoff`,
and the manifest-first `Preferred portable input` / compat fallback split.
- `--district`
- `--segment`
- `--reason`
- `--since`
- `--limit`
- `--json`
- `--out`
- `--summary-base-url`
- `--raw-out`
- `--raw-base-url`
- `--packet-out`
- `--packet-root-url`
- `--packet-issue-limit`
- `--csv-out`
- `--csv-root-url`

When `--packet-out` is provided, the CLI now writes:
- `summary.md`: human-readable packet index
- `manifest.json`: machine-readable packet index
- `top-segments/*.json`
- `top-reasons/*.json`

When `--packet-root-url` / `--csv-root-url` are provided, that packet `manifest.json` also records
URL-aware packet, CSV, and publish-gate-district hotspot links so external automation does not need
to reconstruct file URLs from markdown output.
The legacy `--packet-base-url` / `--csv-base-url` flags remain accepted as compatibility aliases.
The packet `summary.md` also switches to URL-aware tables in that mode, so human handoff can click
through without opening the JSON manifest first.
The CLI stdout now also emits `Packet handoff` / `CSV handoff` blocks in that mode, so operators
see the canonical packet `manifest.json`, packet `summary.md`, packet root URL, CSV exchange
root, and preferred join file without reopening the saved summary.
The packet `manifest.json` is now versioned with `artifactType=issue-report-triage-packets` and
`schemaVersion=1`.
When `--json` is combined with any of these export flags, the JSON output is versioned with
`artifactType=issue-report-summary-json` and `schemaVersion=1`. Its `artifacts` object carries the
resolved summary/raw/csv/packet paths, canonical packet/csv root URLs, legacy `*BaseUrl` compat
aliases, and portable
`*RelativePath` arrays/fields so automation can inspect packet and CSV bundle contents without
depending on runner-specific absolute paths.
`--summary-base-url` and `--raw-base-url` also materialize `summaryUrl` and `rawIssuesUrl`, so
manual triage exports can point directly at their canonical saved summary/raw surfaces instead of
only carrying file paths.

Validate a saved `--json` export and inspect its portable artifact contract:

- `npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json`
- `npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json --json`
- `npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json --json --out .tmp/index-surface.json`

The raw summary validator now derives the canonical manual handoff too: from a saved
`issue-summary.json` it will surface the canonical full index entry `issue-summary-index.json`,
the canonical portable manifest `artifacts-manifest.json`, and the explicit
`Preferred portable input` / `Fallback compatibility input` split. That lets an operator start from
the raw summary export without treating the full index as the final exchange format.
`--summary` remains accepted as a compatibility alias for `--input`.
The raw `issue-report-summary-json` export itself now also carries direct
`preferredCsvPath` / `preferredCsvRelativePath` / `preferredCsvUrl`,
`packetRootPath`, `packetRootUrl`, `csvRootPath`, `csvRootUrl`, `packetSummaryUrl`, and
`packetManifestUrl` fields inside
`artifacts`, so downstream automation can jump straight to the preferred CSV join file and
canonical packet root/summary/manifest without waiting for later compact sidecars.
Its human-readable output now also prints `Input surface` and `Canonical full-index handoff`, so
the CLI itself makes the upstream surface and downstream exchange format explicit. It now also
spells out the packet root, packet root URL, packet `manifest.json`, packet `summary.md`, CSV
exchange root, and preferred CSV join file when those exports exist. `--out` is now supported too,
and the write-path stdout still prints the same canonical handoff instead of collapsing to a bare
`Wrote ...`.

Build a normalized consumer index from a saved summary export:

- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-summary-index.json`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-summary-index.json`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --write-index`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-summary-index.json --index-base-url https://example.com/manual-index`
- `npm run ops:issue-report-summary-artifacts -- --input .tmp/issue-summary.json --label "Manual Triage" --index-base-url https://example.com/manual-index`
- `npm run ops:issue-report-summary-artifacts -- --input .tmp/artifacts-manifest.json --label "Manual Refresh" --index-base-url https://example.com/manual-index`
- `npm run ops:issue-report-summary-artifacts -- --input .tmp/issue-summary-index.json --label "Manual Refresh (compat)" --index-base-url https://example.com/manual-index`

When the saved summary export includes `packetManifestPath`, this normalized index also follows the
nested packet manifest so downstream automation can consume packet entry lists and publish-gate
district to hotspot packet mappings without reparsing packet markdown by hand.
The human-readable index output now also prints `Input surface` and `Canonical full-index handoff`,
so an operator can see immediately that the normalized index came from `issue-report-summary-json`
and that `issue-summary-index.json` is the canonical full-index exchange file.
When the same summary export also carries `summaryUrl` / `rawIssuesUrl`, the normalized summary
index preserves those links in `summaryFile.url` and `rawIssuesFile.url`, so downstream consumers do
not need to reopen the raw summary JSON just to discover the canonical manual source summary
surfaces.
When the normalized summary index itself is written with `--out`, add `--index-base-url` to
materialize its own canonical handoff too. The saved `issue-report-summary-index.json` will then
carry `indexFile.relativePath` / `indexFile.url`, and downstream summary consumers reuse those as
the manual `artifactIndexRelativePath` / `artifactIndexUrl` bridge back to the full normalized
index.
The human-readable summary from `ops:issue-report-summary-index` now also states the same intent
explicitly: `artifacts-manifest.json` is the `Preferred portable input`, and the normalized full
index is only the `Fallback compatibility input`.
`--write-index` is the canonical write mode for this normalized index. With `--json`, it writes the
index next to the source summary using the stable `<summary-name>-index.json` filename, so manual
triage automation no longer needs to hardcode an `--out` path just to persist the normalized index.
When you want the full manual handoff in one step, `ops:issue-report-summary-artifacts` writes the
canonical `artifacts-manifest.json`, `issue-summary-index.json`, `index-summary.md`,
`index-summary.json`, and `index-surface.json` next to the saved summary.
The same command can also refresh that canonical sidecar family from an existing
`artifacts-manifest.json` or `issue-summary-index.json` by passing it to `--input`.
That `artifacts-manifest.json` is the preferred portable manual input: downstream consumers can
accept it directly and auto-follow the canonical manual sidecar family instead of discovering
sibling files by convention.
The saved manual `issue-summary-index.json` also carries a canonical `manualManifestFile` pointer,
and the generated `index-summary.json` / `index-surface.json` sidecars repeat that
`artifacts-manifest.json` entry and URL so compact consumers can still discover the preferred
manual handoff without reopening the full index. That manual manifest now also overrides the
canonical CSV root / CSV root URL and packet root / packet root URL across the raw summary export,
normalized index, `index-summary.json`, and `index-surface.json`, so downstream consumers follow
the same manual handoff instead of recomputing those roots from stale sidecars.

### Workflow artifact CLI

Generate the same packet/CSV artifacts that GitHub workflows upload:

- `npm run ops:issue-report-artifacts`
- `npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts`
- `npm run ops:issue-report-artifacts -- --sync-store .tmp/sync-service.json --limit 10 --packet-issue-limit 5`
- `npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json`
- `npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json --packet-root-url https://example.com/packets --csv-root-url https://example.com/csv`
- `npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --index-base-url https://example.com/issue-index`
- `npm run ops:issue-report-artifacts -- --manifest .tmp/nightly-issue-artifacts/manifest.json --packet-root-url https://example.com/packets --csv-root-url https://example.com/csv`

Default output layout:
- `.tmp/issue-report-artifacts/summary.md`
- `.tmp/issue-report-artifacts/manifest.json`
- `.tmp/issue-report-artifacts/packets/**`
- `.tmp/issue-report-artifacts/csv/**`

`summary.md` is a human-readable workflow summary, and `manifest.json` records the exact
generated paths plus matching/total issue counts. When `--publish-gate-summary` is provided,
both files also include the compact publish-gate totals and top failing/warning districts.
When `--packet-root-url` / `--csv-root-url` are provided, `summary.md` and `manifest.json`
also carry URL-aware district-to-hotspot packet mappings and canonical packet/CSV root URLs.
Legacy `--packet-artifact-url` / `--csv-artifact-url` remain compat aliases only.
The root `manifest.json` is now versioned with `artifactType=issue-report-workflow-artifacts` and
`schemaVersion=1`, and it carries the explicit `packetManifestPath` for the nested packet bundle.
The packet bundle index at `.tmp/issue-report-artifacts/packets/summary.md` also carries the same
compact publish-gate section, so packet-only downloads retain release-facing gate context.

When `--manifest` is provided, `ops:issue-report-artifacts` switches into refresh mode:
- it loads and validates the existing root workflow manifest plus nested packet manifest
- it reuses the already-written packet JSON and CSV files
- it rewrites `summary.md`, `manifest.json`, and the nested packet summary/manifest with updated packet/csv root URLs
- it does not reread the sync store or rebuild hotspot packets

### Manifest validator CLI

Validate a versioned issue-report artifact manifest before downstream automation consumes it:

- `npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --expect workflow`
- `npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --expect workflow --follow-packet`
- `npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/packets/manifest.json --expect packet`
- `npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --json`

Use `--follow-packet` when validating a workflow/root manifest to also load the nested packet
manifest and verify cross-manifest integrity:
- `packetManifestPath`, `packetRootPath`, `packetSummaryPath`, and CSV roots
- packet/CSV file lists
- publish-gate district -> issue hotspot packet mappings
- shared counts like `totalCount`, `filteredCount`, and `storageFile`

### Manifest consumer CLI

Build a normalized machine-readable index from a workflow/root issue artifact manifest:

- `npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json`
- `npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json --json`
- `npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json --json --write-artifact-index`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/artifact-index.json --label "Publish"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly" --json --write-index-summary`
- `npm run ops:validate-issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json`
- `npm run ops:validate-issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --json --write-index-surface`
- `npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-report-summary-index.json`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-summary.json --label "Manual Triage"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --label "Manual Triage"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-summary-index.json --label "Manual Triage (compat)"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --json --write-index-summary`
- `npm run ops:validate-issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --json --write-index-surface`

This CLI always follows the nested packet manifest automatically and emits a stable inspection view with:
- root/workflow manifest metadata
- nested packet manifest metadata
- relation summary counts
- compact publish-gate summary
- top issue-report districts, segments, and reasons
- publish-gate district -> issue hotspot packet mappings
- segment packet entries, reason packet entries, and CSV exports

Use the summary consumer when you want a release-facing markdown view driven by the same normalized
index. It accepts workflow `artifact-index.json`, the canonical workflow `manifest.json`, the canonical manual
`artifacts-manifest.json`, manual `issue-report-summary-index.json`, the raw
`issue-report-summary-json` export, or the canonical
`issue-report-artifact-summary-json` sidecar at `index-summary.json`, the compact
`issue-report-artifact-summary-surface` sidecar at `index-surface.json`, or the workflow/root
`manifest.json`. Workflow manifest input is the preferred portable handoff because the consumer
will auto-follow canonical `index-surface.json` via the manifest's relative-path contract and
only fall back to heavier surfaces when needed. For the first five surfaces it will auto-build or
follow the intermediate index when needed:
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/artifact-index.json --label "Nightly"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly" --json --write-index-summary`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-summary.json --label "Manual Triage"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --label "Manual Triage"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-summary-index.json --label "Manual Triage (compat)"`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/index-summary.json`
- `npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/index-surface.json`
- add `--write-index-summary` when consuming workflow `manifest.json` to rewrite the canonical root summary sidecars; with `--json`, it writes `indexSummaryJsonPath`, and without `--json` it rewrites `indexSummaryPath` after auto-following the canonical compact surface when present
- both `--out` and `--write-index-summary` now keep the canonical handoff in stdout too, so operators still get the preferred portable input, packet manifest, and CSV join hints after writing the sidecar file
- `artifact-index.json` and `index-surface.json` remain supported compatibility inputs when a downstream automation already has those more specific surfaces
- `--index` and `--index-url` are still accepted as legacy aliases for `--input` and `--input-url`
- manual `artifacts-manifest.json`, `issue-report-summary-index.json` (compat), and raw `issue-report-summary-json` now share the same sidecar family as workflow artifacts: `--write-index-summary` writes `index-summary.md` / `index-summary.json` next to the saved manual index, and `--write-index-surface` writes the matching `index-surface.json`
- `ops:validate-issue-report-artifact-summary` validates that sidecar and prints a compact machine-readable surface for downstream automation, including publish-gate totals and the top district / segment / reason slices from `index-summary.json`; workflow `manifest.json` is the preferred input and auto-follows the canonical summary sidecar
- add `--write-index-surface` to persist that compact surface back to the canonical `indexSurfacePath` recorded in workflow `manifest.json`; `--out` remains available when a caller needs a non-canonical surface file path, and either write mode now prints the same canonical handoff summary back to stdout

### Workflow-produced issue artifacts

These GitHub workflows now build and upload issue triage artifacts automatically:
- `.github/workflows/nightly.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/ingest_dry_run.yml`

Each workflow:
1. Runs `npm run ops:issue-report-artifacts`.
2. Appends `publish_gate_summary.md` into the workflow run summary when a publish-gate result exists.
3. Uploads publish-gate summary artifacts, sign-override preflight artifacts, and issue triage artifacts.
4. Refreshes `summary.md` / `manifest.json` with uploaded packet/csv root URLs by rerunning `ops:issue-report-artifacts --manifest ...`.
5. Builds the canonical `artifact-index.json` from the refreshed workflow manifest with `ops:issue-report-artifact-index --write-artifact-index`.
6. Renders `index-summary.json` from workflow `manifest.json`, validates it into `index-surface.json`, then rewrites the canonical `index-summary.md` from that same workflow `manifest.json`.
7. Uploads a dedicated issue index artifact containing `summary.md`, `index-summary.md`, `index-summary.json`, `manifest.json`, and the normalized artifact index.
8. Validates the root workflow manifest with `ops:validate-issue-report-artifacts --follow-packet --follow-surface`, which also validates the nested packet manifest, `index-summary.json`, `index-surface.json`, and cross-manifest links.
9. Validates the canonical compact surface from workflow `manifest.json` with `ops:validate-issue-report-artifact-summary`.
10. Writes the issue artifact summary into the workflow run summary from workflow `manifest.json`, which auto-follows the canonical `index-surface.json` with `ops:issue-report-artifact-summary`.
11. Appends artifact download links to the workflow run summary.

Artifact contents:
- `summary.md`: high-level issue hotspot summary for the run.
- `index-summary.md`: canonical release/workflow summary re-rendered from `index-surface.json` after validating `index-summary.json`.
- `index-summary.json`: versioned `issue-report-artifact-summary-json` sidecar rendered from the same `artifact-index.json`, carrying input-surface provenance, portable artifact paths, and parser-canonicalized `packetRootUrl` / `csvRootUrl` handoff. Legacy `packetArtifactUrl` / `csvArtifactUrl` fields remain only as compat aliases.
- `index-surface.json`: compact versioned `issue-report-artifact-summary-surface` export derived from `index-summary.json`, carrying publish-gate totals plus the top district / segment / reason slices for downstream dashboards, along with the preferred CSV join hint and canonical packet/CSV root handoff for portable triage exchange.
- both compact sidecars now also carry direct `packetRootPath`, `packetRootUrl`, `csvRootPath`, `csvRootUrl`, `packetSummaryUrl`, `packetManifestUrl`, `preferredCsvRelativePath`, and `preferredCsvUrl` fields, and the parsers canonicalize those root URLs from legacy aliases when needed. Downstream consumers therefore do not need to reconstruct the canonical packet root, CSV exchange root, packet summary, packet manifest, or preferred CSV join hint from `csvExports` or legacy artifact/base URL aliases. Human/nightly consumers now also trust those root-path/root-url fields first when they are present.
- the raw/manual parser layer now treats `csvBaseUrl` / `packetBaseUrl` as explicit compat aliases too: validator errors and schema checks name them as legacy aliases for `csvRootUrl` / `packetRootUrl`, instead of treating them like first-class canonical fields.
- the raw `ops:validate-issue-report-summary --json` surface now mirrors that same naming: it emits first-class `packetRootUrl` / `packetBaseUrl` / `csvRootUrl` / `csvBaseUrl`, while the older `packetArtifactUrl` remains only as a deeper compat alias for pre-root-url raw-summary consumers.
- `ops:issue-report-summary-artifacts` now uses that same root-url-first handoff in its result/stdout: `csvRootUrl` / `packetRootUrl` are canonical, `csvBaseUrl` / `packetBaseUrl` are compat aliases, and `packetArtifactUrl` is retained only as an older manual-surface fallback.
- workflow/manual artifact manifest parsing now makes the same distinction too: `packetArtifactUrl` / `csvArtifactUrl` are validated as explicit legacy compat aliases for `packetRootUrl` / `csvRootUrl`, so parser errors call out the alias directly instead of misreporting the canonical root field.
- nested packet manifest parsing now follows the same pattern for `packetBaseUrl` / `csvBaseUrl`, so all three manifest families call out legacy compat aliases directly in parser errors.
- the workflow/manual artifact writers now match that parser contract too: new `manifest.json` refreshes only write `packetArtifactUrl` / `csvArtifactUrl` when those legacy aliases actually differ from the canonical root URLs, instead of mirroring the canonical root fields back into the compat slots.
- the manifest parsers now preserve that distinction too: when a bundle omits those legacy alias fields, parsed workflow/manual/packet manifest objects keep them as `null` instead of rehydrating them from the canonical root URLs.
- both `index-summary.json` and `index-surface.json` now also carry the portable `artifactIndexRelativePath`, and when `--index-base-url` is provided they also carry `artifactIndexUrl`, so downstream automation that only receives the compact sidecars can still resolve the canonical full `artifact-index.json` inside the bundle or link to it directly.
- when `--index-base-url` is provided, the workflow/root `manifest.json`, `artifact-index.json`,
  `index-summary.json`, and `index-surface.json` also carry canonical summary URLs:
  `summaryUrl`, `indexSummaryUrl`, `indexSummaryJsonUrl`, and `indexSurfaceUrl`.
  That lets downstream automation jump directly to the workflow human summary, canonical release
  summary, canonical summary JSON, and compact summary surface without reconstructing URLs from
  bundle-relative paths.
- `manifest.json`: machine-readable artifact manifest.
- `artifact-index.json`: normalized consumer-facing index built from the root + nested packet manifests.
- `artifact-index.json` now also carries the canonical `preferredCsvFile`, so workflow/full-index consumers do not have to re-pick the join CSV from the raw export list.
- workflow `manifest.json`, manual `artifacts-manifest.json`, and the normalized `artifact-index.json.rootManifest` now all carry the same `preferredCsvPath` / `preferredCsvRelativePath` / `preferredCsvUrl` pointer family, and downstream summary/nightly consumers now treat that root pointer as canonical before falling back to packet/full-index CSV discovery.
- `ops:issue-report-artifact-summary`: release-facing markdown summary rendered directly from `artifact-index.json`, `index-summary.json`, or the compact `index-surface.json`.
- workflow/root `manifest.json`: now also carries `summaryRelativePath`, `indexSummaryPath`, `indexSummaryJsonPath`, `indexSurfacePath`, `artifactIndexPath`, and portable `indexSummaryRelativePath` / `indexSummaryJsonRelativePath` / `indexSurfaceRelativePath` / `artifactIndexRelativePath`, while the nested packet manifest carries its own `summaryRelativePath`, so downstream automation can find every human-readable and machine-readable summary file without hardcoded paths or runner-specific absolute paths.
- `packets/top-segments/*.json`: top recurring segment issue packets.
- `packets/top-reasons/*.json`: top recurring reason-code issue packets.
- `csv/top-districts.csv`
- `csv/latest-districts.csv`
- `csv/top-segments.csv`
- `csv/top-reasons.csv`
- `csv/recent-issues.csv`
- `csv/publish-gate-districts.csv` when `--publish-gate-summary` is provided, carrying machine-readable district-to-hotspot mappings
- workflow `issue-index` artifact: refreshed `summary.md`, `index-summary.md`, `index-summary.json`, `index-surface.json`, `manifest.json`, and `artifact-index.json` with packet/csv download URLs
- `summary.md`, `manifest.json`, `artifact-index.json`, `index-summary.json`, and `index-surface.json`
  now all carry the same canonical summary URL family (`summaryUrl`, `indexSummaryUrl`,
  `indexSummaryJsonUrl`, `indexSurfaceUrl`) when `--index-base-url` is configured
- `ops:notify-nightly -- --issue-input`: now accepts workflow `manifest.json`, the full `artifact-index.json`, the versioned `index-summary.json`, or the compact `index-surface.json`; nightly workflow prefers `manifest.json`, which auto-follows `index-surface.json`, uses `index-summary.json` as the sidecar fallback, and only rebuilds from sync state when no artifact consumer input exists. `--issue-index` and `--issue-index-url` remain supported as legacy aliases.
- nightly artifact references now also include `Issue index summary json`, so the GitHub issue/comment
  can link directly to the canonical machine-readable summary sidecar instead of only the markdown
  summary or full `artifact-index.json`
- nightly artifact references now also include the packet `manifest.json` as the preferred portable
  packet input and the preferred CSV join file, so the GitHub issue/comment matches the same
  portable handoff contract as `index-summary.json` / `index-surface.json`
- when a packet root URL is available, nightly now also links directly to the canonical packet
  `summary.md`, not just the packet root
