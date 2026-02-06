export const SETTINGS_SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  settingsSchemaVersion: 'pk.settingsSchemaVersion',
  datasetId: 'pk.datasetId',
  radiusMeters: 'pk.radiusMeters',
  riskMode: 'pk.riskMode',
  includeInferred: 'pk.includeInferred',
  showZones: 'pk.showZones',
  showIntersectionZones: 'pk.showIntersectionZones',
  showCrosswalkZones: 'pk.showCrosswalkZones',
  showInferredCandidates: 'pk.showInferredCandidates',
  useMockLocation: 'pk.useMockLocation',
}

const SETTINGS_KEYS = Object.values(STORAGE_KEYS).filter(
  (key) => key !== STORAGE_KEYS.settingsSchemaVersion,
)

let schemaChecked = false
let schemaValid = true

const parseStoredVersion = (raw: string | null) => {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as number
  } catch {
    return null
  }
}

const ensureSchemaVersion = () => {
  if (typeof window === 'undefined') {
    return
  }
  if (schemaChecked) {
    return
  }
  schemaChecked = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.settingsSchemaVersion)
    const stored = parseStoredVersion(raw)
    if (stored !== SETTINGS_SCHEMA_VERSION) {
      schemaValid = false
      SETTINGS_KEYS.forEach((key) => {
        window.localStorage.removeItem(key)
      })
      window.localStorage.setItem(
        STORAGE_KEYS.settingsSchemaVersion,
        JSON.stringify(SETTINGS_SCHEMA_VERSION),
      )
    }
  } catch {
    schemaValid = false
  }
}

export const readSetting = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }
  ensureSchemaVersion()
  if (!schemaValid && key !== STORAGE_KEYS.settingsSchemaVersion) {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeSetting = (key: string, value: unknown) => {
  if (typeof window === 'undefined') {
    return
  }
  ensureSchemaVersion()
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

export const resetSettingsCacheForTests = () => {
  schemaChecked = false
  schemaValid = true
}
