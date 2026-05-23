import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { PACK_FILES } from './hashFiles'

export const validateMeta = (meta: Record<string, unknown>, errors: string[]) => {
  const required = [
    'schemaVersion',
    'metricsSchemaVersion',
    'districtId',
    'districtName',
    'generatedAt',
    'configPath',
    'configHash',
    'datasetHash',
    'sourceFiles',
  ]
  required.forEach((key) => {
    if (!meta[key]) {
      errors.push(`[dataset_meta] missing required field: ${key}`)
    }
  })

  const countKeys = [
    'parkingSpaces',
    'intersections',
    'crosswalks',
    'signOverrides',
    'inferredCandidates',
    'overridesApplied',
  ]
  countKeys.forEach((key) => {
    if (
      typeof meta.counts !== 'object' ||
      meta.counts === null ||
      typeof (meta.counts as Record<string, unknown>)[key] !== 'number'
    ) {
      errors.push(`[dataset_meta] counts.${key} is required`)
    }
  })

  const numericFields = [
    'segmentsCount',
    'signOverridesCount',
    'parkingSpacesCount',
    'overridesAppliedCount',
  ]
  numericFields.forEach((key) => {
    if (typeof meta[key] !== 'number') {
      errors.push(`[dataset_meta] ${key} is required`)
    }
  })

  if (typeof meta.curbMarkingKnownRate !== 'number') {
    errors.push('[dataset_meta] curbMarkingKnownRate is required')
  } else if (meta.curbMarkingKnownRate < 0 || meta.curbMarkingKnownRate > 1) {
    errors.push('[dataset_meta] curbMarkingKnownRate must be between 0 and 1')
  }

  if (typeof meta.restrictionTriggeredRate !== 'number') {
    errors.push('[dataset_meta] restrictionTriggeredRate is required')
  } else if (meta.restrictionTriggeredRate < 0 || meta.restrictionTriggeredRate > 1) {
    errors.push('[dataset_meta] restrictionTriggeredRate must be between 0 and 1')
  }

  if (!meta.intersectionsBBox) {
    errors.push('[dataset_meta] intersectionsBBox is required')
  }
  if (!('parkingSpacesBBox' in meta)) {
    errors.push('[dataset_meta] parkingSpacesBBox is required')
  }
  if (!meta.boundaryBBox) {
    errors.push('[dataset_meta] boundaryBBox is required')
  }
  if (!meta.boundaryCenter) {
    errors.push('[dataset_meta] boundaryCenter is required')
  }
  if (!('signOverridesBBox' in meta)) {
    errors.push('[dataset_meta] signOverridesBBox is required')
  }
  if (!('inferredRiskCounts' in meta)) {
    errors.push('[dataset_meta] inferredRiskCounts is required')
  }
  if (typeof meta.files !== 'object' || meta.files === null) {
    errors.push('[dataset_meta] files map is required')
  }
  if (typeof meta.totalBytes !== 'number') {
    errors.push('[dataset_meta] totalBytes is required')
  }

  if (Array.isArray(meta.sourceFiles)) {
    meta.sourceFiles.forEach((file, index) => {
      if (!file.path || !file.mtimeMs) {
        errors.push(`[dataset_meta] sourceFiles[${index}] missing path/mtimeMs`)
      }
    })
  } else {
    errors.push('[dataset_meta] sourceFiles must be an array')
  }
}

export const validateMetaFiles = async (
  baseDir: string,
  meta: Record<string, unknown>,
  errors: string[],
) => {
  if (typeof meta.files !== 'object' || meta.files === null) {
    return
  }

  const filesMap = meta.files as Record<string, { sha256?: string; bytes?: number }>
  const requiredFiles = new Set(PACK_FILES.required)
  const optionalFiles = new Set(PACK_FILES.optional)

  PACK_FILES.required.forEach((fileName) => {
    if (!filesMap[fileName]) {
      errors.push(`[dataset_meta] files missing entry for ${fileName}`)
    }
  })

  for (const [fileName, entry] of Object.entries(filesMap)) {
    const isRequired = requiredFiles.has(fileName)
    const isOptional = optionalFiles.has(fileName)

    if (!isRequired && !isOptional) {
      errors.push(`[dataset_meta] files has unexpected entry for ${fileName}`)
      continue
    }

    const filePath = path.resolve(baseDir, fileName)
    try {
      const stat = await fs.stat(filePath)
      if (isRequired && stat.size <= 0) {
        errors.push(`[${fileName}] expected non-empty file`)
      }
      if (typeof entry?.bytes !== 'number') {
        errors.push(`[dataset_meta] files.${fileName}.bytes missing`)
      } else if (entry.bytes <= 0 && isRequired) {
        errors.push(`[dataset_meta] files.${fileName}.bytes must be > 0`)
      }
      if (typeof entry?.sha256 !== 'string' || entry.sha256.length === 0) {
        errors.push(`[dataset_meta] files.${fileName}.sha256 missing`)
      }
    } catch {
      errors.push(`[dataset_meta] files lists ${fileName} but it is missing on disk`)
    }
  }
}

export const validateIntersectionsReport = (
  report: Record<string, unknown>,
  errors: string[],
) => {
  const counts = report.counts as Record<string, unknown> | undefined
  if (!counts || typeof counts.finalIntersections !== 'number') {
    errors.push('[intersections_report] counts.finalIntersections is required')
  }
  if (!report.angleSpreadHistogram) {
    errors.push('[intersections_report] angleSpreadHistogram is required')
  }
}
