# Issue Report Triage Runbook

This runbook covers the ParkKing issue report pipeline from in-app submission to GitHub workflow artifacts.

## Source Of Truth

Issue reports are written into the first-party sync store:

- default file: `.tmp/sync-service.json`
- shared route: `/api/sync/issues`

Each issue report includes:
- scope
- district id
- optional segment id
- free-text summary
- created timestamp
- debug bundle snapshot from the reporting client

## Local Triage

Render a human-readable summary:

```bash
npm run ops:issue-report-summary -- --scope alpha
```

Filter by district, segment, or reason:

```bash
npm run ops:issue-report-summary -- --district xinyi --since 2026-04-02
npm run ops:issue-report-summary -- --segment seg-1 --reason TIME_WINDOW
npm run ops:issue-report-summary -- --district xinyi --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json
```

Write structured exports:

```bash
npm run ops:issue-report-summary -- --out .tmp/issue-summary.md
npm run ops:issue-report-summary -- --json --out .tmp/issue-summary.json
npm run ops:issue-report-summary -- --json --out .tmp/issue-summary.json --summary-base-url https://example.com/issue-summary
npm run ops:issue-report-summary -- --raw-out .tmp/raw-issues.json
npm run ops:issue-report-summary -- --raw-out .tmp/raw-issues.json --raw-base-url https://example.com/raw-issues
npm run ops:issue-report-summary -- --csv-out .tmp/issue-csv --csv-root-url https://example.com/issue-csv
npm run ops:issue-report-summary -- --packet-out .tmp/issue-packets --packet-root-url https://example.com/issue-packets
```

Useful outputs:
- `topDistricts`: highest recurring districts
- `latestDistricts`: most recently affected districts
- `topSegments`: most frequently reported segments
- `topReasons`: most frequent reason codes
- `issues`: recent filtered issue list
- `rawIssues`: full raw synced issue payloads

When `--publish-gate-summary` is provided, the human-readable summary and JSON output also carry
the compact publish-gate totals plus the top publish-gate districts, so local triage stays aligned
with workflow artifacts and nightly issues.
When `--packet-out` is provided, the CLI also writes `summary.md`, `manifest.json`,
`top-segments/*.json`, and `top-reasons/*.json`. The packet `manifest.json` records machine-readable
packet entries, optional CSV export URLs, and publish-gate district to issue-hotspot packet mappings.
When `--packet-root-url` / `--csv-root-url` are provided, those packet and CSV links are emitted
directly in the manifest, and the packet `summary.md` switches to URL-aware tables for human review.
The legacy `--packet-base-url` / `--csv-base-url` flags remain accepted as compatibility aliases.
The CLI stdout also prints `Packet handoff` / `CSV handoff` blocks in that mode, so the canonical
packet `manifest.json`, packet `summary.md`, packet root URL, CSV exchange root, and preferred
join file are visible without reopening the saved summary markdown first.
The packet `manifest.json` is versioned with `artifactType=issue-report-triage-packets` and
`schemaVersion=1`.
When `--json` is combined with export flags, the JSON output is versioned with
`artifactType=issue-report-summary-json` and `schemaVersion=1`. It also includes an `artifacts`
object so automation can read resolved summary/raw/csv/packet paths, canonical root URLs, legacy
`*BaseUrl` compatibility aliases, and
portable `*RelativePath` fields directly instead of reconstructing bundle entries from absolute
runner paths.
`--summary-base-url` and `--raw-base-url` also materialize `summaryUrl` and `rawIssuesUrl`, so a
manual triage export can point directly at its canonical saved summary/raw surfaces instead of only
carrying file paths.
When `--out` writes a human-readable summary, that markdown now appends an `Artifact handoff`
block so the same CLI output spells out the `Input surface`, the `Canonical full-index handoff`,
and the manifest-first `Preferred portable input` / compat fallback split.

Validate a saved summary export:

```bash
npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json
npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json --json
npm run ops:validate-issue-report-summary -- --input .tmp/issue-summary.json --json --out .tmp/index-surface.json
```

That validator now derives the canonical manual handoff directly from the saved summary export:
it surfaces `issue-summary-index.json` as the canonical full index, `artifacts-manifest.json` as
the preferred portable manual input, and the explicit `Preferred portable input` /
`Fallback compatibility input` split. So even when an operator starts from raw
`issue-report-summary-json`, the output still points at the manifest-first handoff.
`--summary` remains supported as a compatibility alias for `--input`.
The raw `issue-report-summary-json` export itself now also carries direct
`preferredCsvPath` / `preferredCsvRelativePath` / `preferredCsvUrl`,
`packetRootPath`, `packetRootUrl`, `csvRootPath`, `csvRootUrl`, `packetSummaryUrl`, and
`packetManifestUrl` fields inside
`artifacts`, so downstream automation can link straight to the preferred CSV join file and
canonical packet root/summary/manifest without waiting for the later compact sidecars.
The human-readable validator output also prints `Input surface` and
`Canonical full-index handoff`, so the upstream raw export and downstream exchange file are visible
without opening any sidecar JSON. When packet/CSV exports exist, it also spells out the packet
root, packet root URL, packet `manifest.json`, packet `summary.md`, CSV exchange root, and
preferred CSV join file. `--out` is supported too, and its write-path stdout still prints the same
canonical handoff.

Build a normalized consumer index from that saved summary export:

```bash
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-summary-index.json
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --write-index
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-summary-index.json --index-base-url https://example.com/manual-index
npm run ops:issue-report-summary-artifacts -- --input .tmp/issue-summary.json --label "Manual Triage" --index-base-url https://example.com/manual-index
npm run ops:issue-report-summary-artifacts -- --input .tmp/artifacts-manifest.json --label "Manual Refresh" --index-base-url https://example.com/manual-index
npm run ops:issue-report-summary-artifacts -- --input .tmp/issue-summary-index.json --label "Manual Refresh (compat)" --index-base-url https://example.com/manual-index
```

If that saved summary export also includes a `packetManifestPath`, the normalized index follows the
nested packet manifest and carries segment/reason packet entries plus publish-gate district to issue
hotspot packet mappings directly in its machine-readable output.
The human-readable normalized index output also prints `Input surface` and
`Canonical full-index handoff`, so the command itself states that it was derived from
`issue-report-summary-json` and that `issue-summary-index.json` is the canonical full-index handoff.
If the saved summary export also carries `summaryUrl` / `rawIssuesUrl`, the normalized index
preserves those links in `summaryFile.url` and `rawIssuesFile.url`, so downstream consumers do not
need to reopen the raw summary JSON to find the canonical manual summary surfaces.
If the normalized index itself is written with `--out`, add `--index-base-url` to materialize its
own canonical handoff too. The saved `issue-report-summary-index.json` will then carry
`indexFile.relativePath` / `indexFile.url`, and downstream summary consumers reuse those as the
manual `artifactIndexRelativePath` / `artifactIndexUrl` bridge back to the full normalized index.
The human-readable `ops:issue-report-summary-index` output also makes this explicit:
`artifacts-manifest.json` is the preferred portable input, while the normalized full index remains
the compatibility fallback.
`--write-index` is the canonical write mode for this normalized index. With `--json`, it writes the
index next to the source summary using the stable `<summary-name>-index.json` filename, so manual
triage automation no longer needs to hardcode an `--out` path just to persist the normalized index.
When you want the full manual handoff in one step, `ops:issue-report-summary-artifacts` writes the
canonical `artifacts-manifest.json`, `issue-summary-index.json`, `index-summary.md`,
`index-summary.json`, and `index-surface.json` next to the saved summary.
That same command can also refresh the canonical manual sidecar family from an existing
`artifacts-manifest.json` or `issue-summary-index.json` when you pass it to `--input`.
`artifacts-manifest.json` is the preferred portable manual input for downstream consumers because it
auto-follows the canonical manual sidecar family instead of relying on sibling-file conventions.
The saved manual `issue-summary-index.json` also carries a canonical `manualManifestFile` pointer,
and the generated `index-summary.json` / `index-surface.json` sidecars repeat that
`artifacts-manifest.json` entry and URL so compact consumers can still discover the preferred
manual handoff without reopening the full index. That manual manifest now also overrides the
canonical CSV root / CSV root URL and packet root / packet root URL across the raw summary export,
normalized index, `index-summary.json`, and `index-surface.json`, so downstream consumers follow
the same manual handoff instead of recomputing those roots from stale sidecars.

## Workflow Artifact Bundle

Generate the same bundle used by GitHub workflows:

```bash
npm run ops:issue-report-artifacts
npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts
npm run ops:issue-report-artifacts -- --sync-store .tmp/sync-service.json --limit 10 --packet-issue-limit 5
npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json
npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --publish-gate-summary public/data/generated/_ops/publish_gate_summary.json --packet-root-url https://example.com/packets --csv-root-url https://example.com/csv
npm run ops:issue-report-artifacts -- --out-root .tmp/nightly-issue-artifacts --index-base-url https://example.com/issue-index
npm run ops:issue-report-artifacts -- --manifest .tmp/nightly-issue-artifacts/manifest.json --packet-root-url https://example.com/packets --csv-root-url https://example.com/csv
npm run ops:refresh-workflow-issue-artifacts -- --manifest .tmp/nightly-issue-artifacts/manifest.json --label "Nightly" --packet-root-url https://example.com/packets --csv-root-url https://example.com/csv --publish-gate-summary-url https://example.com/publish-gate-summary
```

Output layout:

- `summary.md`: human-readable summary for workflow run pages
- `index-summary.md`: canonical release/workflow summary re-rendered from `index-surface.json` after validating `index-summary.json`
- `index-summary.json`: versioned `issue-report-artifact-summary-json` sidecar rendered from the same normalized index
- `index-surface.json`: compact versioned `issue-report-artifact-summary-surface` export derived from `index-summary.json`, including the preferred CSV join hint plus the canonical packet/CSV root handoff for portable triage exchange
- both compact sidecars now also carry direct `packetRootPath`, `packetRootUrl`, `csvRootPath`, `csvRootUrl`, `packetSummaryUrl`, `packetManifestUrl`, `preferredCsvRelativePath`, and `preferredCsvUrl` fields, so consumers can jump straight to the canonical packet root, CSV exchange root, packet summary, packet manifest, and preferred CSV join file without rebuilding those hints from `csvExports` or legacy root artifact entries. Human/nightly consumers now also trust those root-path/root-url fields first when they are present.
- both compact sidecars also carry the portable `artifactIndexRelativePath`, and when `--index-base-url` is provided they also carry `artifactIndexUrl`, so a consumer that only has `index-summary.json` or `index-surface.json` can still follow the canonical full `artifact-index.json` inside the bundle or link to it directly
- the raw/manual parsers now make the same distinction in machine validation: `csvBaseUrl` / `packetBaseUrl` are treated as explicit compat aliases for `csvRootUrl` / `packetRootUrl`, and parser errors name them that way.
- the raw `ops:validate-issue-report-summary --json` surface now matches that contract too: it exposes `packetRootUrl` / `packetBaseUrl` / `csvRootUrl` / `csvBaseUrl` directly, and only keeps `packetArtifactUrl` as an older compat alias for pre-root-url consumers.
- `ops:issue-report-summary-artifacts` now follows the same naming in its refresh result/stdout, so manual artifact refresh output and raw summary validation output use the same root-url-first packet/CSV handoff vocabulary.
- the workflow/manual artifact manifest parsers now match that contract as well: `packetArtifactUrl` / `csvArtifactUrl` are treated as explicit legacy compat aliases for `packetRootUrl` / `csvRootUrl`, and parser failures name those aliases directly.
- the nested packet manifest parser now does the same for `packetBaseUrl` / `csvBaseUrl`, so workflow/manual/packet manifests all use the same compat-alias error contract.
- the workflow/manual artifact writers now follow the same rule: refreshed `manifest.json` files only populate `packetArtifactUrl` / `csvArtifactUrl` when those legacy aliases actually differ from the canonical root URLs, so new bundles stop mirroring canonical roots into compat-only fields.
- the manifest parsers now preserve that same contract on read: when workflow/manual/packet bundles omit the legacy alias fields, parsed manifest objects keep them as `null` instead of silently backfilling them from canonical root URLs.
- when `--index-base-url` is provided, the workflow/root `manifest.json`, `artifact-index.json`, `index-summary.json`, and `index-surface.json` also carry the canonical summary URLs `summaryUrl`, `indexSummaryUrl`, `indexSummaryJsonUrl`, and `indexSurfaceUrl`, and downstream summary/nightly consumers now treat the root `preferredCsvPath` / `preferredCsvRelativePath` / `preferredCsvUrl` pointer as canonical before falling back to packet/full-index CSV discovery
- `manifest.json`: machine-readable manifest with generated paths and counts
- `artifact-index.json`: normalized consumer-facing index built from the refreshed workflow/root manifest
- `artifact-index.json` now also carries the canonical `preferredCsvFile`, so workflow/full-index consumers can follow the preferred join CSV directly instead of re-picking from the raw export list
- workflow `manifest.json`, manual `artifacts-manifest.json`, and `artifact-index.json.rootManifest` now carry the same `preferredCsvPath` / `preferredCsvRelativePath` / `preferredCsvUrl` pointer family, so root-level consumers can discover the canonical join CSV without reopening packet CSV lists
- `packets/top-segments/*.json`: per-segment hotspot packets
- `packets/top-reasons/*.json`: per-reason hotspot packets
- `csv/top-districts.csv`
- `csv/latest-districts.csv`
- `csv/top-segments.csv`
- `csv/top-reasons.csv`
- `csv/recent-issues.csv`
- `csv/publish-gate-districts.csv` when a publish-gate summary is provided, so downstream tooling can join gate districts to the current top issue hotspot segment without scraping markdown

When `--publish-gate-summary` is provided, `summary.md` and `manifest.json` also carry the
compact publish-gate totals plus the top publish-gate districts, so issue triage bundles retain
the same release-facing gate status shown in workflow summaries and nightly issues. When
`--packet-root-url` / `--csv-root-url` are provided, that root summary/manifest also
becomes URL-aware and records the district-to-hotspot packet index that automations can follow
without scraping markdown. Legacy `--packet-artifact-url` / `--csv-artifact-url` remain
compat aliases only.
The root `manifest.json` is versioned with `artifactType=issue-report-workflow-artifacts` and
`schemaVersion=1`, and it includes the explicit nested `packetManifestPath`.
The packet index at `packets/summary.md` mirrors that same compact publish-gate section, so a
packet-only handoff still preserves current gate status.

When `--manifest` is provided, the CLI switches into refresh mode: it loads the existing versioned
workflow manifest plus nested packet manifest, validates them, reuses the packet JSON / CSV files
already on disk, and rewrites the root and packet summaries/manifests with the new root URLs.
That avoids rebuilding the issue summary from the sync store just to attach upload URLs after a
workflow artifact upload step.
GitHub workflows call `ops:refresh-workflow-issue-artifacts` for that post-upload phase. The wrapper
combines the manifest URL refresh, `artifact-index.json`, `index-summary.json`,
`index-surface.json`, and `index-summary.md` writes into one Node command, so workflow YAML does not
need shell-specific command chaining or environment-variable interpolation.

## Manifest Validation

Validate the versioned manifests before another automation consumes them:

```bash
npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --expect workflow
npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --expect workflow --follow-packet
npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/packets/manifest.json --expect packet
npm run ops:validate-issue-report-artifacts -- --manifest .tmp/issue-report-artifacts/manifest.json --json
```

`--follow-packet` makes the validator load the nested packet manifest referenced by the workflow
root manifest and check cross-manifest integrity for packet roots, CSV roots, packet/CSV file
lists, shared counts, and publish-gate district -> issue hotspot packet links.

## Manifest Consumer CLI

Build a normalized inspection index from a workflow/root manifest:

```bash
npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json
npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json --json
npm run ops:issue-report-artifact-index -- --manifest .tmp/issue-report-artifacts/manifest.json --json --write-artifact-index
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly"
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/artifact-index.json --label "Nightly"
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --label "Nightly" --json --write-index-summary
npm run ops:validate-issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json
npm run ops:validate-issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/manifest.json --json --write-index-surface
npm run ops:issue-report-summary-index -- --input .tmp/issue-summary.json --json --out .tmp/issue-report-summary-index.json
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-summary.json --label "Manual Triage"
npm run ops:issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --label "Manual Triage"
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-summary-index.json --label "Manual Triage (compat)"
npm run ops:issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --json --write-index-summary
npm run ops:validate-issue-report-artifact-summary -- --input .tmp/artifacts-manifest.json --json --write-index-surface
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/index-summary.json
npm run ops:issue-report-artifact-summary -- --input .tmp/issue-report-artifacts/index-surface.json
```

This consumer CLI always follows the nested packet manifest and emits:
- workflow/root manifest metadata
- packet manifest metadata
- relation summary counts
- compact publish-gate summary
- top issue-report districts, segments, and reasons
- publish-gate district -> issue hotspot packet mappings
- segment packet entries, reason packet entries, and CSV exports

`ops:issue-report-artifact-summary` is the human-facing consumer for that same normalized index. It
accepts workflow `manifest.json`, workflow `artifact-index.json`, the canonical manual
`artifacts-manifest.json`, manual `issue-report-summary-index.json`, the raw
`issue-report-summary-json` export, the canonical
`issue-report-artifact-summary-json` sidecar at `index-summary.json`, or the compact
`issue-report-artifact-summary-surface` sidecar at `index-surface.json`. Workflow `manifest.json`
is the preferred portable input because the consumer follows the manifest's canonical
`index-surface.json` entry first and only falls back to heavier surfaces when needed. For the
first five surfaces it auto-builds or auto-follows the intermediate summary surface when needed.
It renders a release/workflow summary from any of those surfaces instead of reusing the older
workflow `summary.md`. With `--write-index-summary`, workflow `manifest.json` input writes to the
canonical summary sidecars recorded in the root manifest: with `--json` it writes
`indexSummaryJsonPath`, and without `--json` it rewrites `indexSummaryPath` after auto-following
the canonical `index-surface.json` when present. `artifact-index.json` and `index-surface.json`
remain supported compatibility inputs, but the preferred portable handoff is always workflow
`manifest.json`. Both `--out` and `--write-index-summary` still print the canonical handoff back to
stdout, so operators keep the preferred portable input, packet manifest, and CSV join hints after
writing a sidecar file. The preferred flag is `--input`; `--index` and `--index-url` remain supported as
legacy aliases for `--input` and `--input-url`.
Manual `artifacts-manifest.json`, `issue-report-summary-index.json`, and raw
`issue-report-summary-json` now share the same sidecar family too: `--write-index-summary`
writes `index-summary.md` / `index-summary.json` next to the saved manual index, and
`--write-index-surface` writes the matching `index-surface.json`.
When a manual `issue-report-summary-index` or `issue-report-summary-json` input carries
`summaryUrl` / `rawIssuesUrl`, the rendered human summary now also emits `Source summary URL` /
`Raw issues URL`, so manual triage handoff gets the same direct-link behavior as workflow artifacts.

`ops:validate-issue-report-artifact-summary` validates the canonical summary sidecar and emits
a compact inspection surface for downstream automation without having to reopen `artifact-index.json`
or parse markdown. Workflow `manifest.json` is the preferred input and auto-follows the canonical
`index-summary.json`; `artifact-index.json`, `index-summary.json`, and `index-surface.json` remain
supported when the caller already has a more specific surface. Its `--json` output now also carries
compact publish-gate totals plus the top district / segment / reason slices from `index-summary.json`.
Add `--write-index-surface` to persist that compact surface back to the canonical sidecar path; on
workflow input it writes the `indexSurfacePath` recorded in `manifest.json`, and on manual
`issue-report-summary-index.json` input it writes the sibling `index-surface.json`. `--out`
remains available when a caller needs a non-canonical surface file such as
`.tmp/issue-report-artifacts/index-surface.json`.
Those write paths now also print the same canonical handoff summary to stdout, so the saved file
does not replace the portable exchange guidance.
When those canonical sidecars are generated from a workflow artifact bundle, they also expose
`artifactIndexRelativePath` plus the URL-aware `summaryUrl`, `indexSummaryUrl`,
`indexSummaryJsonUrl`, and `indexSurfaceUrl` fields, so downstream automation can round-trip from a
compact sidecar back to the full normalized index and the canonical human-readable summaries.

## GitHub Workflow Integration

These workflows all generate and upload issue triage artifacts, and they also attach the current
publish-gate markdown summary when a gate result exists:

- `.github/workflows/nightly.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/ingest_dry_run.yml`

Each workflow does the same sequence:

1. Append `publish_gate_summary.md` into `GITHUB_STEP_SUMMARY` when available.
2. Run `npm run ops:issue-report-artifacts`.
3. Upload packet artifacts.
4. Upload CSV artifacts.
5. Refresh `summary.md` / `manifest.json` with the uploaded packet/csv root URLs by rerunning `ops:issue-report-artifacts --manifest ...`.
6. Build the canonical `artifact-index.json` from the refreshed root manifest with `ops:issue-report-artifact-index --write-artifact-index`.
7. Render `index-summary.json` from workflow `manifest.json`, validate it into `index-surface.json`, then re-render the canonical `index-summary.md` from that same workflow `manifest.json`.
8. Upload a dedicated issue index artifact containing `summary.md`, `index-summary.md`, `index-summary.json`, `index-surface.json`, `manifest.json`, and the normalized artifact index.
9. Validate the root workflow manifest with `ops:validate-issue-report-artifacts --follow-packet --follow-surface`, which also validates the nested packet manifest, `index-summary.json`, `index-surface.json`, and the workflow-to-packet links.
10. Validate the canonical compact surface from workflow `manifest.json` with `ops:validate-issue-report-artifact-summary`.
11. Append the workflow `manifest.json` driven summary into `GITHUB_STEP_SUMMARY` with `ops:issue-report-artifact-summary`; that consumer auto-follows `index-surface.json`.
12. Append artifact download URLs into `GITHUB_STEP_SUMMARY`.

Nightly additionally forwards publish-gate summary and issue artifact URLs into `ops:notify-nightly`, so the GitHub nightly issue/comment can include:

1. a compact publish-gate summary
2. top publish-gate districts
3. direct links to the downloadable publish-gate and issue-triage bundles
4. direct links to the canonical `index-summary.json` machine-readable summary sidecar
5. the canonical packet root and packet root URL for the same bundle
6. the packet `manifest.json` preferred portable input and the preferred CSV join file for the same bundle
7. the canonical packet `summary.md` URL when the packet/root URL handoff is present

When the local workflow artifact bundle already includes workflow issue artifacts, `ops:notify-nightly`
can consume the full `artifact-index.json`, the versioned `index-summary.json`, or the compact
workflow `manifest.json` or the compact sidecars directly. All of those surfaces now parse
canonical `packetRootUrl` / `csvRootUrl` first and keep legacy artifact/base URL fields as compat aliases only:

```bash
npm run ops:notify-nightly -- --diff public/data/generated/xinyi --issue-input .tmp/issue-report-artifacts/manifest.json
```

That path skips rebuilding issue hotspot summaries from the sync store and instead reuses the
workflow-produced artifact consumer output. Workflow `manifest.json` is now the preferred portable
input because it auto-follows canonical `index-surface.json`; `index-summary.json` is the
versioned sidecar fallback when the compact surface has not been materialized yet; and
`artifact-index.json` remains supported when a downstream automation needs the full nested
manifest/index surface.

The workflow/root `manifest.json` and normalized `artifact-index.json` now both expose
portable `summaryRelativePath`, `indexSummaryPath`, `indexSummaryJsonPath`, `indexSurfacePath`,
`artifactIndexPath`, and their matching `*RelativePath` fields, while the nested packet manifest exposes its own
`summaryRelativePath`. That lets downstream automation discover every human-readable and
machine-readable summary file without hardcoding `.tmp/...` paths or depending on runner-specific
absolute paths. When `--index-base-url` is configured they also expose matching canonical URLs for
the same surfaces, so consumers can jump directly to `summary.md`, `index-summary.md`,
`index-summary.json`, and `index-surface.json`.

Publish, dry-run, and nightly workflows also append their run summaries from this same normalized
consumer index, so workflow summaries and nightly issues stay on the same artifact contract.

## Suggested Ops Loop

1. Open the latest workflow run summary.
2. Check `summary.md` counts and top hotspots.
3. Download packet and CSV artifacts if triage is needed.
4. Use `top-segments.csv` and `top-reasons.csv` to find recurring failures.
5. Open matching packet JSON files for bounded recent raw bundles.
6. If needed, pull filtered local exports with `ops:issue-report-summary --raw-out`.
7. Convert repeated validated findings into overrides, ingest fixes, or copy changes.
