import { describe, expect, it } from 'vitest'
import {
  resolveWorkerEvaluationMode,
  shouldUseWorkerEvaluationTimeout,
} from './useSegmentEvaluationState'

describe('resolveWorkerEvaluationMode', () => {
  it('uses chunked zone-aware evaluation for large zoned datasets', () => {
    expect(
      resolveWorkerEvaluationMode({
        useWorker: true,
        segmentCount: 20_000,
        zoneCount: 3_000,
      }),
    ).toBe('chunked-zone-aware')
  })

  it('keeps small zoned datasets on the worker path', () => {
    expect(
      resolveWorkerEvaluationMode({
        useWorker: true,
        segmentCount: 2_000,
        zoneCount: 1,
      }),
    ).toBe('zone-aware')
  })

  it('uses base-only worker evaluation when no zones exist', () => {
    expect(
      resolveWorkerEvaluationMode({
        useWorker: true,
        segmentCount: 2_000,
        zoneCount: 0,
      }),
    ).toBe('base-only')
  })

  it('disables worker evaluation when workers or segments are unavailable', () => {
    expect(
      resolveWorkerEvaluationMode({
        useWorker: false,
        segmentCount: 2_001,
        zoneCount: 1,
      }),
    ).toBe('disabled')
    expect(
      resolveWorkerEvaluationMode({
        useWorker: true,
        segmentCount: 0,
        zoneCount: 1,
      }),
    ).toBe('disabled')
  })
})

describe('shouldUseWorkerEvaluationTimeout', () => {
  it('only times out active worker evaluation modes', () => {
    expect(shouldUseWorkerEvaluationTimeout('working', 'base-only')).toBe(true)
    expect(shouldUseWorkerEvaluationTimeout('working', 'zone-aware')).toBe(true)
    expect(
      shouldUseWorkerEvaluationTimeout('working', 'chunked-zone-aware'),
    ).toBe(false)
    expect(shouldUseWorkerEvaluationTimeout('working', 'disabled')).toBe(false)
    expect(shouldUseWorkerEvaluationTimeout('ready', 'zone-aware')).toBe(false)
  })
})
