# Park King

Curb intelligence prototype. The ingest pipeline builds district datasets and publishes packs for the app.

## Quickstart

- Install: `npm ci`
- Dev: `npm run dev`
- Tests: `npm test`
- Build: `npm run build`

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

`configs/prod/<districtId>.json` is created by the scaffolder.

```json
{
  "districtId": "xinyi",
  "districtName": "Xinyi",
  "inputs": {
    "districtBounds": "data/raw/xinyi/district_bounds.shp",
    "redYellow": "data/raw/xinyi/red_yellow.shp",
    "busStops": "data/raw/xinyi/bus_stops.shp",
    "hydrants": "data/raw/xinyi/hydrants.shp",
    "road_centerlines": "data/raw/xinyi/road_centerlines.shp",
    "crosswalks": "data/raw/xinyi/crosswalks.shp",
    "sign_overrides": "data/raw/xinyi/sign_overrides.geojson"
  },
  "outputs": {
    "generatedDir": "data/generated/xinyi",
    "publicDir": "public/data/generated/xinyi"
  },
  "crs": { "default": "EPSG:3826" },
  "ops": { "thresholds": { "counts": { "segments": 20 } } }
}
```

### Deterministic Command Sequence

1. Scaffold config:
   `npm run ops:new-district -- --districtId <id> --districtName "<Name>" --sourceRoot "data/raw/<id>"`
2. Validate inputs:
   `npm run ops:check-inputs -- --config configs/prod/<id>.json`
3. Ingest + publish:
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

## Multi-district Ops

Run the same pipeline across many districts by using a config glob:

`npm run ingest:all -- --configs "configs/prod/*.json"`

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

`ops:fetch-sources` writes per-district provenance to:
- `data/sources/<districtId>/provenance.json`

Raw inputs should be stored under:
- `data/raw/<districtId>/...`

## CI Fixtures

To rebuild the CI fixture pack:

`npm run ingest:all -- --configs "configs/ci-fixtures.json" --allowWarn --override "ci"`

## QA Sampling

Generate manual QA candidates (CSV) from the latest district pack or generated folder:

- `npm run ops:sample-qa -- --district xinyi --topN 50 --riskMode Neutral --radius 600`
- `npm run ops:sample-qa -- --all --topN 50`

Default output path:
- `public/data/generated/<districtId>/qa_candidates.csv`

Suggested manual review loop:
1. Open candidate rows in Street View / map imagery.
2. Record verdicts in the in-app report flow.
3. Export overrides (`Export reports` in UI or `npm run ops:export-overrides -- --input <reports.jsonl-or-json>`).
4. Ingest again (`npm run ingest:all -- --configs "configs/prod/<districtId>.json"`).

## Pack Diff Reports

Each publish writes a `diff_report.json` into the published pack directory:
- `public/data/generated/<districtId>/diff_report.json`

The publish gate consumes this report (or computes one) to flag suspicious deltas.
Set `PARKKING_GATE_STRICT=1` to escalate diff WARN rules (segments delta, coverage drops, overrides ratio)
into FAILs in CI.

Run locally:
- `npm run ops:diff-packs -- --prev <path> --next <path>`
- `npm run ops:diff-packs -- --next <path> --format md`

## Metrics History

Each publish appends a line to:
- `public/data/generated/<districtId>/metrics_history.jsonl`

History is capped to the most recent 180 entries per district.

To generate manually:
- `npm run ops:write-metrics-history -- --pack <path> --prevPack <path>`

## Health Deltas

Dataset Health shows “Since last publish” deltas for segments, overrides, and coverage rates.
These are derived from `metrics_history.jsonl` when available.

## Nightly Notifications

The nightly workflow posts a GitHub issue or comment when diff reports include WARN/FAIL
districts. It links to the workflow run for details.

Manual run:
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId>/diff_report.json`
- `npm run ops:notify-nightly -- --diff public/data/generated/<districtId>`
