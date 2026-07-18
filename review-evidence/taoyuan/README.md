# Taoyuan source-text approval evidence

This directory contains project-owner-reviewed source-text decisions promoted
from `.tmp/taoyuan-human-review/`.

Run `npm run ops:promote-taoyuan-review` to validate every row against
`public/data/reference/taoyuan-paid-curb.json` before replacing the tracked
CSV and manifest. The promotion gate requires every row to be
`APPROVED_SOURCE_TEXT` and rejects source drift.
The promoted manifest also pins the reviewed CSV SHA-256 and approved row count,
so partial or out-of-band changes fail closed.

Approval covers source transcription only. Geometry availability and
`legalAnswerEligible` must remain false.
