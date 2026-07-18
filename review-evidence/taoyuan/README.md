# Taoyuan source-text approval evidence

This directory contains project-owner-reviewed source-text decisions promoted
from `.tmp/taoyuan-human-review/`.

Run `npm run ops:promote-taoyuan-review` to validate every row against
`public/data/reference/taoyuan-paid-curb.json` before replacing the tracked
CSV and manifest. The promotion gate requires every row to be
`APPROVED_SOURCE_TEXT` and rejects source drift.
For an approved source update, run
`npm run ops:migrate-taoyuan-review-source` with explicit previous/current
references and the human approval CSV. The migration gate rejects unapproved
field changes, segment additions/removals, and district changes. Track its
receipt under `source-migrations/`.
The promoted manifest also pins the reviewed CSV SHA-256 and approved row count,
so partial or out-of-band changes fail closed.
The SHA uses UTF-8 text with line endings canonicalized to LF so Windows and
Linux checkouts validate the same reviewed content.

Approval covers source transcription only. Geometry availability and
`legalAnswerEligible` must remain false.
