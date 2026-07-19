# Durable Issue Sink Deployment

ParkKing's production Render service has an ephemeral filesystem. The
first-party issue sink uses a Cloudflare Worker for authenticated intake and D1
for durable, idempotent storage.

## Security Boundary

- `POST /issues` requires `PARKKING_ISSUE_SINK_WRITE_TOKEN`.
- `GET /issues` requires a separate `PARKKING_ISSUE_SINK_ADMIN_TOKEN`.
- `GET /health` is a content-free liveness check.
- `GET /ready` checks D1 and both secrets without exposing their values.
- Every write requires the `parkking-<sha256>` idempotency key emitted by the
  Render sync service.
- The Worker does not enable browser CORS. Render calls it server-to-server.
- D1 stores the complete issue debug bundle. Treat the admin token and exports
  as sensitive operational data.

## One-Time Provisioning

Authenticate Wrangler:

```powershell
npx --yes wrangler@4.112.0 login
npx --yes wrangler@4.112.0 whoami
```

Create D1 and note the returned database ID:

```powershell
npx --yes wrangler@4.112.0 d1 create parkking-issue-reports
npm run ops:prepare-issue-sink -- --database-id "<D1 database ID>"
npm run ops:issue-sink:migrate
```

Generate independent 256-bit tokens and install them as Worker secrets:

```powershell
$writeToken = [Convert]::ToHexString(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
).ToLowerInvariant()
$adminToken = [Convert]::ToHexString(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
).ToLowerInvariant()

$writeToken | npx --yes wrangler@4.112.0 secret put PARKKING_ISSUE_SINK_WRITE_TOKEN --config infra/issue-sink/wrangler.jsonc
$adminToken | npx --yes wrangler@4.112.0 secret put PARKKING_ISSUE_SINK_ADMIN_TOKEN --config infra/issue-sink/wrangler.jsonc
npm run ops:issue-sink:deploy
```

Store both tokens in the project password manager. Do not put either token or
the generated `infra/issue-sink/wrangler.jsonc` in Git.

## Connect Render

Set these Render service environment variables and rebuild:

```text
PARKKING_SYNC_ISSUE_SINK_URL=https://<worker>.workers.dev/issues
PARKKING_SYNC_ISSUE_SINK_BEARER_TOKEN=<write token>
PARKKING_SYNC_ISSUE_SINK_TIMEOUT_MS=5000
```

Keep `PARKKING_SYNC_DURABILITY=ephemeral`: it describes Render's local sync
store. Successful issue responses independently report `durable=true` and
`durability=external` after D1 confirms the write.

## Connect Nightly Triage

Set these GitHub Actions repository secrets:

```powershell
$adminUrl = "https://<worker>.workers.dev/issues"
$adminUrl | gh secret set PARKKING_ISSUE_SINK_ADMIN_URL
$adminToken | gh secret set PARKKING_ISSUE_SINK_ADMIN_TOKEN
```

Nightly runs `npm run ops:pull-issue-sink` before the existing issue artifact
pipeline. The pull paginates all durable reports, groups them by scope, and
writes the existing `.tmp/sync-service.json` schema. When the secrets are
absent, the command reports `SKIP` and leaves the current local workflow
unchanged.

Manual protected export:

```powershell
$headers = @{ Authorization = "Bearer $adminToken" }
Invoke-RestMethod -Headers $headers -Uri "$adminUrl?limit=100"
```

Manual triage pull:

```powershell
$env:PARKKING_ISSUE_SINK_ADMIN_URL = $adminUrl
$env:PARKKING_ISSUE_SINK_ADMIN_TOKEN = $adminToken
npm run ops:pull-issue-sink -- --require
npm run ops:issue-report-artifacts
```

## Acceptance Checks

1. Worker `/ready` returns HTTP 200 with `durability=d1`.
2. Render `/api/sync/health` reports `issueSink.configured=true`.
3. A Render `POST /api/sync/issues` response returns
   `durable=true` and `durability=external`.
4. Repeating the same request does not create a second D1 row.
5. The admin export returns the receipt while an unauthenticated export returns
   HTTP 401.
6. `npm run ops:pull-issue-sink -- --require` writes the receipt into the
   expected sync scope.

## Recovery

- Export D1 periodically with
  `npx wrangler d1 export parkking-issue-reports --remote`.
- Rotate the write token in both Worker and Render together.
- Rotate the admin token in both Worker and GitHub Actions together.
- If D1 is unavailable, the Worker returns HTTP 503; Render then returns HTTP
  503 and the browser retains its local issue copy for retry.
