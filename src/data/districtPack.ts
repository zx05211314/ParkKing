import { getDatasetBaseDir } from './datasetResolver'

export const PACK_SCHEMA_VERSION = 1

const PACK_FILES = {
  required: [
    'red_yellow.geojson',
    'bus_stops.geojson',
    'hydrants.geojson',
    'intersections.geojson',
    'intersections_report.json',
  ],
  optional: [
    'parking_spaces.geojson',
    'crosswalks.geojson',
    'sign_overrides.geojson',
    'candidates_inferred.geojson',
    'overrides_applied.geojson',
  ],
}

export interface PackValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface RegistryEntry {
  districtId: string
  districtName: string
  generatedAt: string
  datasetHash: string
  schemaVersion: number
  publishedAt: string
  totalBytes: number
  fileCount: number
  metaSha256: string
  packSha256: string
  latest: {
    datasetHash: string
    publishedAt: string
  }
}

const requiredFiles = [...PACK_FILES.required, 'dataset_meta.json']
const optionalFiles = [...PACK_FILES.optional]

const isBrowser = typeof window !== 'undefined' && typeof window.fetch === 'function'

const joinBase = (baseDir: string, fileName: string) => {
  if (baseDir.endsWith('/')) {
    return `${baseDir}${fileName}`
  }
  return `${baseDir}/${fileName}`
}

const existsInBrowser = async (url: string) => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) {
      return true
    }
    const fallback = await fetch(url, { method: 'GET' })
    return fallback.ok
  } catch {
    return false
  }
}

export const validateFileSet = async (
  districtId: string,
): Promise<PackValidationResult> => {
  const baseDir = getDatasetBaseDir(districtId)
  const errors: string[] = []
  const warnings: string[] = []

  if (!isBrowser) {
    warnings.push('File checks skipped (non-browser environment)')
    return {
      valid: true,
      errors,
      warnings,
    }
  }

  const check = async (fileName: string) => {
    const target = joinBase(baseDir, fileName)
    return existsInBrowser(target)
  }

  const requiredChecks = await Promise.all(requiredFiles.map((file) => check(file)))
  requiredFiles.forEach((file, index) => {
    if (!requiredChecks[index]) {
      errors.push(`Missing required file: ${file}`)
    }
  })

  const optionalChecks = await Promise.all(optionalFiles.map((file) => check(file)))
  optionalFiles.forEach((file, index) => {
    if (!optionalChecks[index]) {
      warnings.push(`Missing optional file: ${file}`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateMeta = (
  meta: unknown,
  expectedSchemaVersion = PACK_SCHEMA_VERSION,
): PackValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!meta || typeof meta !== 'object') {
    return { valid: false, errors: ['Invalid dataset meta object'], warnings }
  }

  const record = meta as Record<string, unknown>
  const schemaVersion = record.schemaVersion
  if (typeof schemaVersion !== 'number') {
    errors.push('schemaVersion is required')
  } else if (schemaVersion !== expectedSchemaVersion) {
    errors.push(
      `schemaVersion mismatch: expected ${expectedSchemaVersion}, got ${schemaVersion}`,
    )
  }

  if (!record.datasetHash) {
    errors.push('datasetHash is required')
  }
  if (!record.districtId) {
    errors.push('districtId is required')
  }
  if (!record.generatedAt) {
    errors.push('generatedAt is required')
  }
  if (!record.districtName) {
    errors.push('districtName is required')
  }
  if (!record.publishMode) {
    errors.push('publishMode is required')
  }
  if (!record.publishedAt) {
    errors.push('publishedAt is required')
  }
  if (!record.signOverrideMatchToleranceMeters) {
    warnings.push('signOverrideMatchToleranceMeters missing; defaulting to 15m')
  }
  if (!record.boundaryCenter) {
    warnings.push('boundaryCenter missing; defaulting to fallback center')
  }

  const counts = record.counts as Record<string, unknown> | undefined
  if (!counts) {
    errors.push('counts is required')
  } else {
    const requiredCounts = [
      'segments',
      'zones',
      'intersections',
      'signOverrides',
      'inferredCandidates',
      'overridesApplied',
    ]
    requiredCounts.forEach((key) => {
      if (typeof counts[key] !== 'number') {
        errors.push(`counts.${key} is required`)
      }
    })
  }

  const files = record.files as Record<string, { sha256?: string; bytes?: number }> | undefined
  if (!files) {
    errors.push('files is required')
  } else {
    PACK_FILES.required.forEach((fileName) => {
      const entry = files[fileName]
      if (!entry) {
        errors.push(`files.${fileName} is required`)
        return
      }
      if (typeof entry.sha256 !== 'string' || entry.sha256.length === 0) {
        errors.push(`files.${fileName}.sha256 is required`)
      }
      if (typeof entry.bytes !== 'number') {
        errors.push(`files.${fileName}.bytes is required`)
      } else if (PACK_FILES.required.includes(fileName) && entry.bytes <= 0) {
        errors.push(`files.${fileName}.bytes must be > 0`)
      }
    })

    PACK_FILES.optional.forEach((fileName) => {
      const entry = files[fileName]
      if (!entry) {
        warnings.push(`files.${fileName} missing; optional layer unavailable`)
        return
      }
      if (typeof entry.sha256 !== 'string' || entry.sha256.length === 0) {
        errors.push(`files.${fileName}.sha256 is required`)
      }
      if (typeof entry.bytes !== 'number') {
        errors.push(`files.${fileName}.bytes is required`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export const validateRegistryEntry = (
  entry: RegistryEntry,
  expectedSchemaVersion = PACK_SCHEMA_VERSION,
): PackValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['Invalid registry entry'], warnings }
  }

  if (!entry.districtId) {
    errors.push('districtId is required')
  }
  if (!entry.districtName) {
    errors.push('districtName is required')
  }
  if (!entry.generatedAt) {
    errors.push('generatedAt is required')
  }
  if (!entry.publishedAt) {
    errors.push('publishedAt is required')
  }
  if (!entry.datasetHash) {
    errors.push('datasetHash is required')
  }
  if (typeof entry.totalBytes !== 'number') {
    errors.push('totalBytes is required')
  }
  if (typeof entry.fileCount !== 'number') {
    errors.push('fileCount is required')
  }
  if (!entry.metaSha256) {
    errors.push('metaSha256 is required')
  }
  if (!entry.packSha256) {
    errors.push('packSha256 is required')
  }
  if (!entry.latest?.datasetHash) {
    errors.push('latest.datasetHash is required')
  }
  if (!entry.latest?.publishedAt) {
    errors.push('latest.publishedAt is required')
  }
  if (entry.schemaVersion !== expectedSchemaVersion) {
    errors.push(
      `schemaVersion mismatch: expected ${expectedSchemaVersion}, got ${entry.schemaVersion}`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

const sha256Buffer = async (buffer: ArrayBuffer) => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto unavailable')
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const verifyPackHashes = async (
  baseDir: string,
  files: Record<string, { sha256: string; bytes: number }>,
): Promise<PackValidationResult> => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isBrowser) {
    warnings.push('Hash verification skipped (non-browser environment)')
    return { valid: true, errors, warnings }
  }

  const entries = Object.entries(files)
  for (const [fileName, entry] of entries) {
    const target = joinBase(baseDir, fileName)
    try {
      const response = await fetch(target)
      if (!response.ok) {
        errors.push(`Failed to fetch ${fileName}`)
        continue
      }
      const buffer = await response.arrayBuffer()
      const bytes = buffer.byteLength
      if (bytes !== entry.bytes) {
        errors.push(`Byte mismatch for ${fileName}`)
      }
      const sha256 = await sha256Buffer(buffer)
      if (sha256 !== entry.sha256) {
        errors.push(`SHA256 mismatch for ${fileName}`)
      }
    } catch {
      errors.push(`Hash check failed for ${fileName}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export const verifyMetaSha256 = async (
  baseDir: string,
  expectedSha256: string,
): Promise<PackValidationResult> => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isBrowser) {
    warnings.push('Meta hash verification skipped (non-browser environment)')
    return { valid: true, errors, warnings }
  }

  const target = joinBase(baseDir, 'dataset_meta.json')
  try {
    const response = await fetch(target)
    if (!response.ok) {
      errors.push('Failed to fetch dataset_meta.json')
      return { valid: false, errors, warnings }
    }
    const buffer = await response.arrayBuffer()
    const sha256 = await sha256Buffer(buffer)
    if (sha256 !== expectedSha256) {
      errors.push('dataset_meta.json sha256 mismatch')
    }
  } catch {
    errors.push('Meta hash verification failed')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
