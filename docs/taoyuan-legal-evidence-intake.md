# Taoyuan legal evidence intake

Taoyuan paid-curb text and TDX representative points are reference-only. They
must not be mapped into legal parking answers. A new official source can enter
the legal-evidence pipeline only after it is normalized into this intake
contract and passes:

```powershell
npm run ops:validate-taoyuan-legal-candidate -- --manifest <candidate-dir>\manifest.json --require-complete --out .tmp\taoyuan-legal-candidate.md --json-out .tmp\taoyuan-legal-candidate.json
```

Passing this command means only `READY_FOR_HUMAN_REVIEW`. It never changes
`legalAnswerEligible` and never writes to `configs/prod`.

## Manifest

`manifest.json` must contain:

```json
{
  "schemaVersion": 1,
  "regionId": "taoyuan",
  "authority": "Official publishing authority",
  "datasetName": "Stable official dataset name",
  "sourceUrl": "https://...",
  "licenseUrl": "https://...",
  "retrievedAt": "2026-07-19T00:00:00.000Z",
  "sourceUpdatedAt": "2026-07-18T00:00:00.000Z",
  "sourcePath": "official-source.zip",
  "sourceSha256": "<lowercase SHA-256 of the raw official source>",
  "crs": "EPSG:4326",
  "legalAnswerEligible": false,
  "requiresHumanReview": true,
  "files": [
    {
      "kind": "PARKING_SPACES",
      "path": "parking-spaces.geojson",
      "sha256": "<lowercase SHA-256 of this normalized file>",
      "featureCount": 1
    },
    {
      "kind": "CURB_RULES",
      "path": "curb-rules.geojson",
      "sha256": "<lowercase SHA-256 of this normalized file>",
      "featureCount": 1
    }
  ]
}
```

The raw official download must accompany the manifest at `sourcePath`, and its
bytes must match `sourceSha256`. All paths must be relative and stay inside the
manifest directory. Both layers are required for `READY_FOR_HUMAN_REVIEW`; one
valid layer is reported as `PARTIAL_CANDIDATE`.

## Common feature fields

Every layer is a GeoJSON `FeatureCollection` with metadata matching the
manifest:

```json
{
  "layerKind": "PARKING_SPACES",
  "datasetName": "Stable official dataset name",
  "crs": "EPSG:4326",
  "legalAnswerEligible": false,
  "requiresHumanReview": true
}
```

Every feature must have a unique `sourceId`, a known Taoyuan `districtId`,
`sourceDataset` equal to the manifest dataset name, and:

```json
{
  "legalAnswerEligible": false,
  "requiresHumanReview": true,
  "reviewStatus": "PENDING"
}
```

The geometry must intersect the declared district in the tracked official
coverage catalog.

## Parking spaces

Parking-space candidates contain only active official marked spaces:

```json
{
  "evidenceKind": "OFFICIAL_PARKING_SPACE",
  "geometryPrecision": "OFFICIAL_SPOT_POSITION",
  "parkingStatus": "ACTIVE"
}
```

Official `Point` or `MultiPoint` spot positions use
`OFFICIAL_SPOT_POSITION`. Official line or polygon space geometry uses
`EXACT_PARKING_SPACE`. A paid-curb segment representative point is not a
parking-space candidate.

## Curb rules

Curb-rule candidates require `LineString` or `MultiLineString` geometry:

```json
{
  "evidenceKind": "OFFICIAL_CURB_RULE",
  "geometryPrecision": "EXACT_CURB_LINE",
  "curbRule": "RED_NO_STOP",
  "timeWindows": []
}
```

Allowed normalized rules are `RED_NO_STOP`, `YELLOW_TEMP_STOP`, and
`PARKING_ALLOWED`. Each time window has `label`, `startHHMM`, and `endHHMM`.
An empty array means the source rule is not time-limited.

## Promotion boundary

After a complete candidate passes, the remaining work is deliberately separate:

1. Build district-stratified human-review packets.
2. Verify rule mapping, schedule semantics, position accuracy, and source age.
3. Add reviewed answer cases for legal, illegal, boundary, and time-window
   outcomes.
4. Add a district config and run dry-run ingest plus strict release gates.
5. Promote only the reviewed normalized output, never the raw candidate.
