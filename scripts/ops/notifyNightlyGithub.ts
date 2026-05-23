export const requestGitHubApi = async (
  url: string,
  token: string,
  init?: RequestInit,
) => {
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

export const resolveNightlyRunUrl = () => {
  const repo = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID
  const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com'
  return repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : null
}
