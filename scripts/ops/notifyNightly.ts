import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface DiffReport {
  districts?: Array<{
    districtId?: string
    severity?: string
    meta?: {
      segmentsCount?: { deltaPct?: number | null }
      curbMarkingKnownRate?: { delta?: number | null }
      restrictionTriggeredRate?: { delta?: number | null }
    }
  }>
}

export interface NightlyAlert {
  districtId: string
  severity: string
  segmentsDeltaPct: number | null
  curbKnownDelta: number | null
  restrictionDelta: number | null
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const diffPaths: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--diff') {
      diffPaths.push(args[index + 1] ?? '')
    }
  }
  return {
    diffPaths,
  }
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const formatSigned = (value: number | null, decimals = 1, suffix = '') => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(decimals)}${suffix}`
}

const formatPercent = (value: number | null) =>
  formatSigned(value === null ? null : value * 100, 1, '%')

const formatPoints = (value: number | null) =>
  formatSigned(value === null ? null : value * 100, 1, 'pp')

export const collectNightlyAlerts = (reports: DiffReport[]): NightlyAlert[] => {
  const alerts: NightlyAlert[] = []
  reports.forEach((report) => {
    report.districts?.forEach((district) => {
      const severity = district.severity ?? 'OK'
      if (severity === 'OK') {
        return
      }
      alerts.push({
        districtId: district.districtId ?? 'unknown',
        severity,
        segmentsDeltaPct: district.meta?.segmentsCount?.deltaPct ?? null,
        curbKnownDelta: district.meta?.curbMarkingKnownRate?.delta ?? null,
        restrictionDelta: district.meta?.restrictionTriggeredRate?.delta ?? null,
      })
    })
  })

  return alerts.sort((a, b) => a.districtId.localeCompare(b.districtId))
}

export const buildNightlyIssueBody = (params: {
  alerts: NightlyAlert[]
  runUrl?: string | null
}) => {
  const lines: string[] = []
  lines.push(`Date: ${new Date().toISOString()}`)
  if (params.runUrl) {
    lines.push(`Run: ${params.runUrl}`)
  }
  lines.push('')
  lines.push('| District | Severity | Segments Δ% | Curb known Δ | Restriction Δ |')
  lines.push('| --- | --- | --- | --- | --- |')
  params.alerts.forEach((alert) => {
    lines.push(
      `| ${alert.districtId} | ${alert.severity} | ${formatPercent(alert.segmentsDeltaPct)} | ${formatPoints(alert.curbKnownDelta)} | ${formatPoints(alert.restrictionDelta)} |`,
    )
  })
  return lines.join('\n')
}

export const resolveDiffPaths = async (inputs: string[]): Promise<string[]> => {
  if (inputs.length === 0 || inputs.some((input) => !input)) {
    throw new Error('Usage: tsx notifyNightly.ts --diff <path>')
  }

  const resolved: string[] = []
  for (const input of inputs) {
    const candidate = path.resolve(input)
    if (!(await fileExists(candidate))) {
      throw new Error(`Diff path not found: ${input}`)
    }
    const stat = await fs.stat(candidate)
    if (stat.isDirectory()) {
      const diffFile = path.resolve(candidate, 'diff_report.json')
      if (!(await fileExists(diffFile))) {
        throw new Error(`diff_report.json not found in ${candidate}`)
      }
      resolved.push(diffFile)
    } else {
      resolved.push(candidate)
    }
  }

  return Array.from(new Set(resolved)).sort((a, b) => a.localeCompare(b))
}

const request = async (url: string, token: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'park-king-nightly',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body}`)
  }
  return response
}

const run = async () => {
  const args = parseArgs(process.argv)
  const diffPaths = await resolveDiffPaths(args.diffPaths)
  if (diffPaths.length === 0) {
    console.log('No diff reports found.')
    return
  }

  const reports = await Promise.all(
    diffPaths.map((diffPath) => readJson<DiffReport>(diffPath)),
  )
  const alerts = collectNightlyAlerts(reports)
  if (alerts.length === 0) {
    console.log('No WARN/FAIL districts found.')
    return
  }

  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  const runUrl = repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : null

  if (!token || !repo) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error('Missing GITHUB_TOKEN or GITHUB_REPOSITORY')
    }
    console.warn('Missing GitHub credentials; skipping notification.')
    return
  }

  const body = buildNightlyIssueBody({ alerts, runUrl })
  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repo}`)
  }

  const issuesUrl = `https://api.github.com/repos/${owner}/${repoName}/issues`
  const issuesResponse = await request(`${issuesUrl}?state=open&per_page=100`, token)
  const issues = (await issuesResponse.json()) as Array<{ number: number; title?: string; pull_request?: unknown }>

  const existing = issues.find(
    (issue) => issue.title === 'Nightly data pipeline warnings' && !issue.pull_request,
  )

  if (existing) {
    await request(`${issuesUrl}/${existing.number}/comments`, token, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    console.log(`Commented on issue #${existing.number}`)
    return
  }

  const createResponse = await request(issuesUrl, token, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Nightly data pipeline warnings',
      body,
    }),
  })
  const created = (await createResponse.json()) as { number?: number }
  console.log(`Created issue #${created.number ?? 'unknown'}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
