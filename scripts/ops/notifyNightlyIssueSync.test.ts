import { describe, expect, it } from 'vitest'
import {
  LEGACY_NIGHTLY_ALERTS_ISSUE_TITLES,
  NIGHTLY_ALERTS_ISSUE_TITLE,
  resolveNightlyIssuesUrl,
  syncNightlyIssue,
  type NightlyGitHubApiRequester,
} from './notifyNightlyIssueSync'

const createJsonResponse = (value: unknown) => ({
  json: async () => value,
})

describe('notifyNightlyIssueSync', () => {
  it('resolves the issues url from owner/repo', () => {
    expect(resolveNightlyIssuesUrl('openai/parkking')).toBe(
      'https://api.github.com/repos/openai/parkking/issues',
    )
    expect(() => resolveNightlyIssuesUrl('bad-repo')).toThrow(
      'Invalid GITHUB_REPOSITORY: bad-repo',
    )
  })

  it('comments on an existing nightly issue when a legacy title is present', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const requestApi: NightlyGitHubApiRequester = async (url, _token, init) => {
      calls.push({ url, init })
      if (calls.length === 1) {
        return createJsonResponse([
          { number: 42, title: LEGACY_NIGHTLY_ALERTS_ISSUE_TITLES[0] },
        ])
      }
      return createJsonResponse({ ok: true })
    }

    const result = await syncNightlyIssue({
      token: 'token',
      repo: 'openai/parkking',
      body: 'body',
      requestApi,
    })

    expect(result).toEqual({ action: 'commented', issueNumber: 42 })
    expect(calls[1]?.url).toContain('/issues/42/comments')
  })

  it('creates a new nightly issue with the alerts title when no existing issue is open', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const requestApi: NightlyGitHubApiRequester = async (url, _token, init) => {
      calls.push({ url, init })
      if (calls.length === 1) {
        return createJsonResponse([])
      }
      return createJsonResponse({ number: 55 })
    }

    const result = await syncNightlyIssue({
      token: 'token',
      repo: 'openai/parkking',
      body: 'body',
      requestApi,
    })

    expect(result).toEqual({ action: 'created', issueNumber: 55 })
    expect(calls[1]?.url).toBe('https://api.github.com/repos/openai/parkking/issues')
    expect(calls[1]?.init?.body).toContain(NIGHTLY_ALERTS_ISSUE_TITLE)
  })
})
