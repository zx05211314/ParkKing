import { describe, expect, it } from 'vitest'
import { getAutoDatasetSelectionAction } from './appSelectionState'

describe('appSelectionState', () => {
  it('does nothing when a dataset is already selected', () => {
    expect(
      getAutoDatasetSelectionAction({
        hasStoredDatasetId: false,
        datasetId: 'xinyi',
        userLocation: [121.565, 25.033],
        locationStatus: 'device',
        fallbackDatasetId: 'daan',
      }),
    ).toEqual({ kind: 'none' })
  })

  it('resolves the district from the user location when available', () => {
    expect(
      getAutoDatasetSelectionAction({
        hasStoredDatasetId: false,
        datasetId: null,
        userLocation: [121.565, 25.033],
        locationStatus: 'device',
        fallbackDatasetId: 'daan',
      }),
    ).toEqual({
      kind: 'resolve-district',
      location: [121.565, 25.033],
    })
  })

  it('falls back to the first dataset only after device location is unavailable', () => {
    expect(
      getAutoDatasetSelectionAction({
        hasStoredDatasetId: false,
        datasetId: null,
        userLocation: null,
        locationStatus: 'unavailable',
        fallbackDatasetId: 'daan',
      }),
    ).toEqual({
      kind: 'select-fallback',
      datasetId: 'daan',
    })
  })

  it('waits while device location is still resolving', () => {
    expect(
      getAutoDatasetSelectionAction({
        hasStoredDatasetId: false,
        datasetId: null,
        userLocation: null,
        locationStatus: 'locating',
        fallbackDatasetId: 'daan',
      }),
    ).toEqual({ kind: 'none' })
  })
})
