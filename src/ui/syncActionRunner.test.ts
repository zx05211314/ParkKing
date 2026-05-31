import { describe, expect, it, vi } from 'vitest'
import {
  buildSyncActionErrorStatus,
  runSyncActionWithResourceState,
} from './syncActionRunner'

describe('syncActionRunner', () => {
  it('runs resource-scoped sync actions and publishes visible success status', async () => {
    const setResourceState = vi.fn()
    const setShareStatus = vi.fn()
    const setBusyState = vi.fn()

    await expect(
      runSyncActionWithResourceState({
        activeResources: ['savedPlans'],
        silent: false,
        setResourceState,
        setShareStatus,
        setBusyState,
        fallbackErrorMessage: 'fallback',
        action: async () => ({
          kind: 'success',
          message: 'ok',
        }),
      }),
    ).resolves.toBe(true)

    expect(setBusyState).toHaveBeenNthCalledWith(1, true)
    expect(setBusyState).toHaveBeenLastCalledWith(false)
    expect(setResourceState).toHaveBeenNthCalledWith(1, ['savedPlans'], true)
    expect(setResourceState).toHaveBeenLastCalledWith(['savedPlans'], false)
    expect(setShareStatus).toHaveBeenCalledWith({
      kind: 'success',
      message: 'ok',
    })
  })

  it('suppresses user-visible status for silent sync actions', async () => {
    const setResourceState = vi.fn()
    const setShareStatus = vi.fn()

    await runSyncActionWithResourceState({
      activeResources: ['reports'],
      silent: true,
      setResourceState,
      setShareStatus,
      fallbackErrorMessage: 'fallback',
      action: async () => ({
        kind: 'success',
        message: 'ok',
      }),
    })

    expect(setShareStatus).not.toHaveBeenCalled()
  })

  it('publishes fallback error status and resets in-flight state on failure', async () => {
    const setResourceState = vi.fn()
    const setShareStatus = vi.fn()
    const inFlightRef = { current: false }

    await expect(
      runSyncActionWithResourceState({
        activeResources: ['savedPlans', 'reports'],
        silent: false,
        setResourceState,
        setShareStatus,
        inFlightRef,
        fallbackErrorMessage: 'fallback',
        action: async () => {
          throw new Error('boom')
        },
      }),
    ).resolves.toBe(false)

    expect(inFlightRef.current).toBe(false)
    expect(setShareStatus).toHaveBeenCalledWith({
      kind: 'error',
      message: 'boom',
    })
    expect(setResourceState).toHaveBeenLastCalledWith(
      ['savedPlans', 'reports'],
      false,
    )
  })

  it('builds fallback error status when the thrown value is not an error', () => {
    expect(buildSyncActionErrorStatus('bad', 'fallback')).toEqual({
      kind: 'error',
      message: 'fallback',
    })
  })
})
