Place ingest config JSON files here.

- PR workflow uses `configs/ci-fixtures.json` only.
- Production configs live under `configs/prod/` and are used by manual publish.
- Tracked source-only approval evidence lives under `review-evidence/`, outside
  all config and production ingest globs.

Add a new district:
1) `npm run ops:new-district -- --districtId <id> --districtName "<name>" --sourceRoot "data/raw/<id>"`
2) `npm run ops:check-inputs -- --config configs/prod/<id>.json`
3) (optional) `npm run ingest:all:dry -- --configs "configs/prod/<id>.json"`
4) `npm run ingest:all -- --configs "configs/prod/<id>.json"`
5) `npm run ops:baseline:seed -- --districtId <id> --root public/data/generated`

Use `--root <installed-release-root>` when seeding from a reviewed release package.
The registry and every district dataset are read exclusively from that same root.
