import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  readSetting,
  resetSettingsCacheForTests,
  SETTINGS_SCHEMA_VERSION,
  STORAGE_KEYS,
} from './settings'

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

describe('settings persistence schema', () => {
  beforeEach(() => {
    resetSettingsCacheForTests()
    const storage = createLocalStorage()
    ;(globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: storage,
    }
    storage.clear()
  })

  afterEach(() => {
    const globalRef = globalThis as Record<string, unknown>
    if ('window' in globalRef) {
      delete globalRef.window
    }
  })

  it('falls back to defaults when schema is missing', () => {
    window.localStorage.setItem(STORAGE_KEYS.datasetId, JSON.stringify('legacy'))
    const value = readSetting(STORAGE_KEYS.datasetId, 'default-id')
    expect(value).toBe('default-id')
    expect(window.localStorage.getItem(STORAGE_KEYS.datasetId)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.settingsSchemaVersion)).toBe(
      JSON.stringify(SETTINGS_SCHEMA_VERSION),
    )
  })

  it('falls back to defaults when schema mismatches', () => {
    window.localStorage.setItem(STORAGE_KEYS.settingsSchemaVersion, JSON.stringify(0))
    window.localStorage.setItem(STORAGE_KEYS.radiusMeters, JSON.stringify(200))
    const value = readSetting(STORAGE_KEYS.radiusMeters, 600)
    expect(value).toBe(600)
    expect(window.localStorage.getItem(STORAGE_KEYS.radiusMeters)).toBeNull()
  })

  it('reads stored values when schema matches', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(SETTINGS_SCHEMA_VERSION),
    )
    window.localStorage.setItem(STORAGE_KEYS.riskMode, JSON.stringify('AGGRESSIVE'))
    const value = readSetting(STORAGE_KEYS.riskMode, 'NEUTRAL')
    expect(value).toBe('AGGRESSIVE')
  })
})
