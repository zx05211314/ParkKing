CREATE TABLE issue_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  issue_id TEXT,
  source_received_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX issue_reports_scope_id_idx
  ON issue_reports (scope, id DESC);

CREATE INDEX issue_reports_issue_id_idx
  ON issue_reports (issue_id);
