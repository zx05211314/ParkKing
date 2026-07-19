import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  requestGitHubApi,
  resolveNightlyRunUrl,
} from './notifyNightlyGithub'
import {
  resolveNightlyIssuesUrl,
  type NightlyGitHubApiRequester,
  type NightlyGitHubIssue,
} from './notifyNightlyIssueSync'
import {
  parseTaoyuanLegalEvidenceMonitorResult,
  type TaoyuanLegalEvidenceMonitorResult,
} from './taoyuanLegalEvidenceMonitor'

const DEFAULT_INPUT = '.tmp/taoyuan-legal-evidence/monitor.json'
export const TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE =
  'Taoyuan official legal evidence monitor'

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const buildTaoyuanLegalEvidenceIssueBody = (params: {
  result: TaoyuanLegalEvidenceMonitorResult
  runUrl?: string | null
  artifactUrl?: string | null
}) =>
  [
    `Monitor status: **${params.result.status}**`,
    '',
    `- Monitored at: ${params.result.monitoredAt}`,
    `- Candidate detected: ${params.result.legalEvidenceCandidateDetected ? 'yes' : 'no'}`,
    `- Source drift detected: ${params.result.sourceDriftDetected ? 'yes' : 'no'}`,
    '- Legal-answer eligible: no',
    ...(params.result.reasons.length > 0
      ? ['', 'Reasons:', ...params.result.reasons.map((reason) => `- ${reason}`)]
      : []),
    ...(params.runUrl ? ['', `Workflow run: ${params.runUrl}`] : []),
    ...(params.artifactUrl ? [`Artifacts: ${params.artifactUrl}`] : []),
    '',
    'This monitor never promotes data. Follow `docs/taoyuan-legal-evidence-intake.md` before human review or production use.',
  ].join('\n')

export const syncTaoyuanLegalEvidenceIssue = async (params: {
  token: string
  repo: string
  result: TaoyuanLegalEvidenceMonitorResult
  runUrl?: string | null
  artifactUrl?: string | null
  requestApi: NightlyGitHubApiRequester
}) => {
  const issuesUrl = resolveNightlyIssuesUrl(params.repo)
  const response = await params.requestApi(
    `${issuesUrl}?state=open&per_page=100`,
    params.token,
  )
  const issues = (await response.json()) as NightlyGitHubIssue[]
  const existing = issues.find(
    (issue) =>
      issue.title === TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE &&
      !issue.pull_request,
  )
  const body = buildTaoyuanLegalEvidenceIssueBody(params)

  if (params.result.attentionRequired) {
    if (existing) {
      await params.requestApi(
        `${issuesUrl}/${existing.number}/comments`,
        params.token,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        },
      )
      return { action: 'commented' as const, issueNumber: existing.number }
    }
    const createResponse = await params.requestApi(issuesUrl, params.token, {
      method: 'POST',
      body: JSON.stringify({
        title: TAOYUAN_LEGAL_EVIDENCE_ISSUE_TITLE,
        body,
      }),
    })
    const created = (await createResponse.json()) as { number?: number }
    return { action: 'created' as const, issueNumber: created.number ?? null }
  }

  if (!existing) {
    return { action: 'noop' as const, issueNumber: null }
  }
  await params.requestApi(
    `${issuesUrl}/${existing.number}/comments`,
    params.token,
    {
      method: 'POST',
      body: JSON.stringify({
        body: `Monitor returned to **${params.result.status}**. Closing this alert.\n\n${body}`,
      }),
    },
  )
  await params.requestApi(`${issuesUrl}/${existing.number}`, params.token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  })
  return { action: 'closed' as const, issueNumber: existing.number }
}

export const runTaoyuanLegalEvidenceIssueNotification = async (options: {
  inputPath?: string
  token?: string
  repo?: string
  runUrl?: string | null
  artifactUrl?: string | null
  githubActions?: boolean
  requestApi?: NightlyGitHubApiRequester
} = {}) => {
  const result = parseTaoyuanLegalEvidenceMonitorResult(
    JSON.parse(
      await fs.readFile(options.inputPath ?? DEFAULT_INPUT, 'utf-8'),
    ) as unknown,
  )
  const token = options.token ?? process.env.GITHUB_TOKEN
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY
  if (!token || !repo) {
    if (options.githubActions ?? process.env.GITHUB_ACTIONS === 'true') {
      throw new Error('Missing GITHUB_TOKEN or GITHUB_REPOSITORY')
    }
    return { action: 'skipped' as const, issueNumber: null }
  }
  return syncTaoyuanLegalEvidenceIssue({
    token,
    repo,
    result,
    runUrl: options.runUrl ?? resolveNightlyRunUrl(),
    artifactUrl:
      options.artifactUrl ??
      process.env.TAOYUAN_LEGAL_EVIDENCE_ARTIFACT_URL ??
      null,
    requestApi: options.requestApi ?? requestGitHubApi,
  })
}

const run = async () => {
  const result = await runTaoyuanLegalEvidenceIssueNotification({
    inputPath: getArgValue(process.argv, '--input') ?? undefined,
  })
  console.log(
    `Taoyuan legal evidence issue sync: ${result.action}${
      result.issueNumber ? ` #${result.issueNumber}` : ''
    }`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
