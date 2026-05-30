import { describe, expect, it, vi } from 'vitest'
import {
  buildWorkflowDispatchRequest,
  dispatchWorkflow,
  getArgValue,
  hasFlag,
  normalizeGithubRepository,
  parseBooleanArg,
  validateHttpUrl,
} from './githubWorkflowDispatch'

describe('github workflow dispatch utilities', () => {
  it('reads flag values in assignment and positional forms', () => {
    expect(getArgValue(['--repo=owner/repo'], '--repo')).toBe('owner/repo')
    expect(getArgValue(['--repo', 'owner/repo'], '--repo')).toBe('owner/repo')
    expect(getArgValue(['--dry-run'], '--dry-run')).toBeNull()
    expect(hasFlag(['--dry-run'], '--dry-run')).toBe(true)
    expect(hasFlag(['--latest=false'], '--latest')).toBe(true)
  })

  it('parses boolean flags consistently', () => {
    expect(parseBooleanArg([], '--latest', false)).toBe(false)
    expect(parseBooleanArg(['--latest'], '--latest', false)).toBe(true)
    expect(parseBooleanArg(['--latest=false'], '--latest', true)).toBe(false)
    expect(() => parseBooleanArg(['--latest=maybe'], '--latest', false)).toThrow(
      '--latest must be true or false',
    )
  })

  it('normalizes repository and URL values', () => {
    expect(normalizeGithubRepository('owner/repo')).toBe('owner/repo')
    expect(normalizeGithubRepository(' owner/repo ')).toBe('owner/repo')
    expect(normalizeGithubRepository('https://github.com/owner/repo')).toBeNull()
    expect(() => validateHttpUrl('https://example.com', '--url')).not.toThrow()
    expect(() => validateHttpUrl('ftp://example.com', '--url')).toThrow(
      '--url must be an http(s) URL',
    )
  })

  it('builds workflow dispatch requests and dry-runs without network calls', async () => {
    const options = {
      repo: 'owner/repo',
      ref: 'main',
      workflow: 'release_data.yml',
      inputs: {
        configsGlob: 'configs/prod/*.json',
      },
      dryRun: true,
      token: null,
      userAgent: 'ParkKing tests',
    }
    expect(buildWorkflowDispatchRequest(options)).toEqual({
      url: 'https://api.github.com/repos/owner/repo/actions/workflows/release_data.yml/dispatches',
      payload: {
        ref: 'main',
        inputs: {
          configsGlob: 'configs/prod/*.json',
        },
      },
    })

    const fetchImpl = vi.fn()
    const result = await dispatchWorkflow(options, fetchImpl)
    expect(result.dispatched).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends authenticated dispatch requests and requires HTTP 204', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      text: async () => '',
    })

    const result = await dispatchWorkflow(
      {
        repo: 'owner/repo',
        ref: 'main',
        workflow: 'render_live_verify.yml',
        inputs: {
          appUrl: 'https://example.com',
        },
        dryRun: false,
        token: 'token',
        userAgent: 'ParkKing tests',
      },
      fetchImpl,
    )

    expect(result.status).toBe(204)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/actions/workflows/render_live_verify.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'user-agent': 'ParkKing tests',
        }),
      }),
    )
  })
})
