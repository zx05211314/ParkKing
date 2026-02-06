# Integrity Fix Report

## Issues Found

### P0
- Clean install baseline showed `npm run lint` failing on unused imports/vars and `any` types.
- Local runtime layout had no dedicated `data/generated -> public/data/generated` sync command for local sanity runs.
- Install hygiene guidance was missing explicit `npm ci` / `do not zip node_modules` instructions.

### P1
- Existing React hook lint warnings in app/map modules prevented a fully clean lint run.

## Files Changed

- `README.md`
- `package.json`
- `scripts/ingest/ingestIntersections.ts`
- `scripts/ingest/ingestRedYellow.ts`
- `scripts/ingest/ingestSignOverrides.ts`
- `scripts/ingest/utils.ts`
- `scripts/ingest/validateOutputs.ts`
- `scripts/ops/compareBaseline.ts`
- `scripts/ops/publishGate.ts`
- `scripts/ops/publishGate.test.ts`
- `scripts/ops/validateConfigs.ts`
- `scripts/ops/smokePublicData.ts` (new)
- `scripts/ops/smokePublicData.test.ts` (new)
- `scripts/ops/syncPublicData.ts` (new)
- `scripts/ops/syncPublicData.test.ts` (new)
- `src/App.settingsPersistence.test.ts`
- `src/App.tsx`
- `src/data/datasetResolver.test.ts`
- `src/data/districtPack.ts`
- `src/map/MapView.tsx`
- `src/ui/SegmentSheet.tsx`

## Verification

Baseline scan/logs are captured in `reports/`:
- `reports/tree_depth4.txt`
- `reports/npm-ci.log`
- `reports/lint.log`
- `reports/test.log`
- `reports/build.log`

Commands run successfully after fixes:
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run ops:sync-public-data`
- `npm run ops:smoke-public-data`
