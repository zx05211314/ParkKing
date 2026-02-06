# Park King Audit Report

## A) Executive summary
- Build and ingest safety had P0 issues that would have blocked releases: ingest:all published packs before the publish gate, and the CI fixture config paths were resolved incorrectly. Both are now fixed, with an added test that asserts no publish occurs when the gate fails.
- Type-level build failures in the runtime app were blocking `npm run build` (regex parsing, registry typing, FeatureCollection fallbacks, and turf buffer overload). These have been fixed with minimal diffs.
- Multi-district boundary ingest and publish meta mutation issues have been resolved (config-driven boundary selection and non-mutating publish flow).

## B) Architecture map (modules + data flow)
**Ingest -> Publish -> Runtime -> UI**
1) **Ingest**
   - `scripts/ingest/readConfig.ts` -> resolves inputs/outputs + hashes
   - `scripts/ingest/ingest*.ts` -> produce GeoJSON outputs in `data/generated/<district>`
   - `scripts/ingest/utils.ts` -> boundary load/clip, buildDatasetMeta, hashFiles
   - `scripts/ingest/validateOutputs.ts` -> enforce schema/geometry/counts

2) **Publish**
   - `scripts/ingest/ingestAll.ts` -> runs ingest + benchmarks + baseline compare + publish gate
   - `scripts/ingest/publishPackAtomic.ts` -> stage/swap to `public/data/generated/<district>`
   - `scripts/ops/manifestWriter.ts` -> manifest per publish
   - `scripts/ops/latestPointer.ts` -> `LATEST.json`
   - `scripts/ops/registryUtils.ts` -> registry entry + hash summaries
   - `scripts/ops/publishGate.ts` -> strict gating on WARN/FAIL

3) **Runtime load**
   - `src/data/datasetResolver.ts` -> base URL + dataset base dir resolution
   - `src/data/loaders/loadGeoJson.ts` -> fetch/FS loader (browser/Node)
   - `src/data/districtPack.ts` -> schema + file/hash validation

4) **Domain evaluation**
   - `src/data/segmentBuilder.ts` -> build segments + overrides + risk tags
   - `src/domain/zones/*` -> buffers, intersections, zone index
   - `src/domain/geometry/*` -> clip + LRU cache
   - `src/domain/rules/evaluateSegment.ts` -> tiering + reason codes
   - `src/domain/scoring/confidence.ts` -> confidence gating
   - `src/domain/ranking/*` -> list ordering

5) **UI / Workers**
   - `src/workers/geoWorker.ts` + `evaluationClient.ts` -> async eval with stale response guard
   - `src/map/MapView.tsx` -> map rendering + interaction
   - `src/ui/*` -> list, sheet, dataset info panel, debug bundle

6) **Ops / CI**
   - `scripts/ops/*` -> baselines, rollback, cleanup, package release, config validator
   - `.github/workflows/*` -> CI tests, dry-run ingest gate, manual publish

## C) Issues table (P0/P1/P2)

### P0 (fixed)
| Severity | Component | Symptom / Impact | Root Cause | Repro | Fix (minimal diff) | Test coverage |
|---|---|---|---|---|---|---|
| P0 | Ingest -> Publish | Packs were published before publish gate ran; gate failure still left public packs swapped. | `ingestAll` called `publishPackAtomic` inside per-district ingest before running gate. | Run `npm run ingest:all` with a config that triggers WARN/FAIL; observe published pack in `public/` even when gate fails. | Move publish step after gate pass and only then write manifests/LATEST/registry. `scripts/ingest/ingestAll.ts:427` | Added `scripts/ingest/ingestAll.test.ts` to assert no publish on gate fail. |
| P0 | CI ingest config | `npm run ingest:all:dry -- --configs configs/ci-fixtures.json` failed because inputs/outputs resolved under `configs/`. | Config paths were root-relative but readConfig resolves relative to config file. | Run `npm run ingest:all:dry -- --configs configs/ci-fixtures.json` (pre-fix). | Updated `configs/ci-fixtures.json` to `../tests/fixtures/...` and outputs `../data/...`; validator accepts `../tests/fixtures`. `configs/ci-fixtures.json:6-17`, `scripts/ops/validateConfigs.ts:99-103` | Existing ingest dry-run now passes. |
| P0 | Runtime build | `npm run build` failed with TS errors (regex parsing, registry typing, FeatureCollection fallbacks, turf buffer overload, override narrow). | Invalid regex literal and strict typing issues in runtime code. | `npm run build` pre-fix. | Fixed regex to `/[\\/]+$/g`, typed registry entries, cast empty FeatureCollections, wrap geometry in feature for turf buffer, and narrow override type. `src/App.tsx:190`, `src/App.tsx:215-290`, `src/domain/zones/buffers.ts:15-23`, `src/data/segmentBuilder.ts:741-747` | `npm run build` now passes. |

### P1 (fixed)
| Severity | Component | Symptom / Impact | Root Cause | Repro | Fix (minimal diff) | Test coverage |
|---|---|---|---|---|---|---|
| P1 | Multi-district ingest | Non-Xinyi districts could not ingest boundaries or validate outputs because boundary file name and matching were hard-coded. | `ingestDistrictBounds` searched only for «H¸q/Xinyi and output `xinyi_boundary.geojson`. `loadBoundary`/`validateOutputs`/`readBoundaryBBox` hard-coded that file name. | Try ingesting a non-Xinyi district config. | Config-driven boundary selection + districtId boundary file naming across ingest/validate. `scripts/ingest/ingestDistrictBounds.ts`, `scripts/ingest/utils.ts`, `scripts/ingest/validateOutputs.ts`, `scripts/ingest/ingestAll.ts` | Added `scripts/ingest/multiDistrict.test.ts` with two districts and manifest checks. |
| P1 | Publish metadata | `publishPackAtomic` mutated source meta before publish; failure could mark generated data as published. | `publishPackAtomic` wrote `publishedAt` into source meta ahead of swap. | Simulate failure between write and rename. | Write updated meta only into staging pack; swap remains atomic. `scripts/ingest/publishPackAtomic.ts` | Extended `scripts/ingest/publishPackAtomic.test.ts` for before/after swap failure scenarios. |

### P2
| Severity | Component | Symptom / Impact | Root Cause | Repro | Fix proposal | Test coverage needed |
|---|---|---|---|---|---|---|
| P2 | Curb marking inference | Chinese color string detection appears corrupted in `inferCurbMarking`. | Encoding/escape issue in `src/data/segmentBuilder.ts`. | Inspect `src/data/segmentBuilder.ts:100-104`. | Replace with proper UTF-8 strings (e.g., ¬õ, ¶À) or use explicit code-point matching. | Unit test for non-ASCII color detection. |
| P2 | Runtime build warnings | Vite warns about `node:fs/promises` being externalized for browser due to dynamic imports. | Mixed Node/browser loader paths in `loadGeoJson` and `districtPack`. | `npm run build` output. | Consider separate Node-only loader for bench/tests and a browser-only loader in app build. | Build warning resolution test or build log assertion (optional). |
| P2 | Dataset resolver (Node) | `DATASET_DIR` bypasses datasetId join which can be confusing for multi-district ops. | `getDatasetBaseDir` returns `DATASET_DIR` directly for Node. | Set `DATASET_DIR` to base dir with multiple districts. | Document expectation or append datasetId when DATASET_DIR points to root. | Add unit test for dataset resolver in Node context. |

## D) Risk checklist (security, data integrity, privacy, performance)
- **Security**: Debug bundle export includes precise segment path coordinates; ensure operator policy for sharing bundles with sensitive locations.
- **Data integrity**: Gate blocks publishing on WARN/FAIL; publish flow no longer mutates source meta pre-swap.
- **Privacy**: Geolocation is optional with mock fallback; no raw PII stored, but debug bundles may include location proximity context.
- **Performance**: Worker + clip cache LRU mitigates heavy turf ops; build output warns about bundle size.

## E) Roadmap
**Milestone 1 (hardening + scale readiness)**
- Add dataset resolver tests + clarify DATASET_DIR semantics.

**Milestone 2 (feature expansion)**
- Multi-district fixtures and CI regression matrix.
- Dedicated browser-only data loader (remove Vite externalization warnings).
- Enhanced debug bundle aggregation with reason-code analytics across districts.

## F) Actionable PR plan
- **PR1 (P0 fixes - done)**: publish-after-gate, CI fixture paths, build fixes + test coverage.
- **PR2 (P1 - done)**: generalize boundary ingest + validation + tests.
- **PR3 (P2)**: encoding cleanup + loader split + documentation of dataset resolver.

---
**Verification plan**
1) `npm test`
2) `npm run build`
3) `npm run ingest:all:dry -- --configs "configs/ci-fixtures.json"`

