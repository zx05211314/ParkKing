# Sign override quarantine

Files in this directory preserve reviewed evidence that must not be loaded as an
active district override. The ingest pipeline only reads
`data/overrides/<district>.jsonl`; it does not read this directory.

Each quarantined entry wraps the original record without changing it and records
why it was removed. A record may only be promoted into another district's active
override file after a human reviews the evidence in that district context.

