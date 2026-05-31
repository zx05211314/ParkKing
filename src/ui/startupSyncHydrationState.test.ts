import { describe, expect, it } from 'vitest'
import { resolveStartupSyncHydrationDetail } from './startupSyncHydrationState'

describe('startupSyncHydrationState', () => {
  it('describes active shared bootstrap loading', () => {
    expect(resolveStartupSyncHydrationDetail('sync-bootstrap', null)).toBe(
      'Loading shared saved plans and reports for this scope.',
    )
  })

  it('describes active local fallback loading', () => {
    expect(
      resolveStartupSyncHydrationDetail('local-fallback', 'local-fallback'),
    ).toBe(
      'Shared bootstrap is unavailable; loading local saved plans and reports.',
    )
  })

  it('preserves ready fallback origin after startup completes', () => {
    expect(
      resolveStartupSyncHydrationDetail('ready', 'local-fallback', '2 min ago'),
    ).toBe(
      'Started from local saved plans and reports because shared bootstrap was unavailable (2 min ago).',
    )
  })
})
