import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { resetSettingsCacheForTests, SETTINGS_SCHEMA_VERSION, STORAGE_KEYS } from '../settings'
import type { SharedAppState } from './shareState'
import { useAppControlUiState } from './useAppControlUiState'

const createLocalStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

const initialSharedState: SharedAppState = {
  datasetId: null,
  filterQuery: '',
  searchResult: null,
  selectedId: null,
  selectedParkingSpaceKey: null,
  recommendationRankMode: null,
  routeProfile: null,
  riskMode: null,
  mode: null,
  radiusMeters: null,
  actionFilter: null,
  markedSpacesOnly: null,
  hideReportedIllegal: null,
  includeInferred: null,
  activeView: null,
}

function Probe() {
  const { useMockLocation } = useAppControlUiState({
    fallbackDatasetOptions: [],
    initialSharedState,
    defaultRadiusMeters: 600,
    defaultRiskMode: 'NEUTRAL',
    defaultSegmentActionFilter: 'ALL',
  })

  return <div>{useMockLocation ? 'mock' : 'device'}</div>
}

describe('useAppControlUiState', () => {
  beforeEach(() => {
    resetSettingsCacheForTests()
    ;(globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: createLocalStorage(),
    }
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(SETTINGS_SCHEMA_VERSION),
    )
  })

  afterEach(() => {
    const globalRef = globalThis as Record<string, unknown>
    if ('window' in globalRef) {
      delete globalRef.window
    }
  })

  it('defaults to device location when no preference was stored', () => {
    expect(renderToStaticMarkup(<Probe />)).toContain('device')
  })

  it('keeps an explicit stored mock-location preference', () => {
    window.localStorage.setItem(STORAGE_KEYS.useMockLocation, JSON.stringify(true))

    expect(renderToStaticMarkup(<Probe />)).toContain('mock')
  })
})
