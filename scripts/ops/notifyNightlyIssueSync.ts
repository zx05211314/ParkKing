export interface NightlyGitHubIssue {
  number: number
  title?: string
  pull_request?: unknown
}

type GitHubApiResponse = {
  json(): Promise<unknown>
}

export type NightlyGitHubApiRequester = (
  url: string,
  token: string,
  init?: RequestInit,
) => Promise<GitHubApiResponse>

export const NIGHTLY_ALERTS_ISSUE_TITLE = 'Nightly data pipeline alerts'
export const LEGACY_NIGHTLY_ALERTS_ISSUE_TITLES = [
  'Nightly data pipeline warnings',
]

export const resolveNightlyIssuesUrl = (repo: string) => {
  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repo}`)
  }
  return `https://api.github.com/repos/${owner}/${repoName}/issues`
}

export const syncNightlyIssue = async (params: {
  token: string
  repo: string
  body: string
  active: boolean
  requestApi: NightlyGitHubApiRequester
}) => {
  const issuesUrl = resolveNightlyIssuesUrl(params.repo)
  const issuesResponse = await params.requestApi(
    `${issuesUrl}?state=open&per_page=100`,
    params.token,
  )
  const issues = (await issuesResponse.json()) as NightlyGitHubIssue[]

  const existing = issues.find(
    (issue) =>
      (issue.title === NIGHTLY_ALERTS_ISSUE_TITLE ||
        LEGACY_NIGHTLY_ALERTS_ISSUE_TITLES.includes(issue.title ?? '')) &&
      !issue.pull_request,
  )

  if (!params.active) {
    if (!existing) {
      return { action: 'noop' as const, issueNumber: null }
    }
    await params.requestApi(
      `${issuesUrl}/${existing.number}/comments`,
      params.token,
      {
        method: 'POST',
        body: JSON.stringify({
          body: `Nightly pipeline returned to a clean state. Closing this alert.\n\n${params.body}`,
        }),
      },
    )
    await params.requestApi(`${issuesUrl}/${existing.number}`, params.token, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    })
    return { action: 'closed' as const, issueNumber: existing.number }
  }

  if (existing) {
    await params.requestApi(`${issuesUrl}/${existing.number}/comments`, params.token, {
      method: 'POST',
      body: JSON.stringify({ body: params.body }),
    })
    return { action: 'commented' as const, issueNumber: existing.number }
  }

  const createResponse = await params.requestApi(issuesUrl, params.token, {
    method: 'POST',
    body: JSON.stringify({
      title: NIGHTLY_ALERTS_ISSUE_TITLE,
      body: params.body,
    }),
  })
  const created = (await createResponse.json()) as { number?: number }
  return { action: 'created' as const, issueNumber: created.number ?? null }
}
