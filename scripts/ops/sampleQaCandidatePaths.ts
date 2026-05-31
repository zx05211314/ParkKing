import * as path from 'node:path'

export const resolveQaOutPath = (params: {
  districtId: string
  all: boolean
  outPath: string | null
}) => {
  if (!params.outPath) {
    return path.resolve('public', 'data', 'generated', params.districtId, 'qa_candidates.csv')
  }

  if (!params.all) {
    return path.resolve(params.outPath)
  }

  const replaced = params.outPath
    .replaceAll('{districtId}', params.districtId)
    .replaceAll('<id>', params.districtId)
  if (replaced !== params.outPath) {
    return path.resolve(replaced)
  }

  const parsed = path.parse(params.outPath)
  if (parsed.ext.toLowerCase() === '.csv') {
    return path.resolve(parsed.dir, `${parsed.name}-${params.districtId}${parsed.ext}`)
  }
  return path.resolve(params.outPath, `${params.districtId}.csv`)
}

export const resolveQaManifestOutPath = (params: {
  districtId: string
  all: boolean
  csvOutPath: string
  manifestOutPath: string | null
}) => {
  if (!params.manifestOutPath) {
    const parsed = path.parse(params.csvOutPath)
    return path.resolve(parsed.dir, `${parsed.name}.manifest.json`)
  }

  if (!params.all) {
    return path.resolve(params.manifestOutPath)
  }

  const replaced = params.manifestOutPath
    .replaceAll('{districtId}', params.districtId)
    .replaceAll('<id>', params.districtId)
  if (replaced !== params.manifestOutPath) {
    return path.resolve(replaced)
  }

  const parsed = path.parse(params.manifestOutPath)
  if (parsed.ext.toLowerCase() === '.json') {
    return path.resolve(
      parsed.dir,
      `${parsed.name}-${params.districtId}${parsed.ext}`,
    )
  }
  return path.resolve(params.manifestOutPath, `${params.districtId}.manifest.json`)
}

export const resolveQaReviewDocOutPath = (params: {
  districtId: string
  all: boolean
  csvOutPath: string
  reviewDocOutPath: string | null
}) => {
  if (!params.reviewDocOutPath) {
    const parsed = path.parse(params.csvOutPath)
    return path.resolve(parsed.dir, `${parsed.name}.review.md`)
  }

  if (!params.all) {
    return path.resolve(params.reviewDocOutPath)
  }

  const replaced = params.reviewDocOutPath
    .replaceAll('{districtId}', params.districtId)
    .replaceAll('<id>', params.districtId)
  if (replaced !== params.reviewDocOutPath) {
    return path.resolve(replaced)
  }

  const parsed = path.parse(params.reviewDocOutPath)
  if (parsed.ext.toLowerCase() === '.md') {
    return path.resolve(
      parsed.dir,
      `${parsed.name}-${params.districtId}${parsed.ext}`,
    )
  }
  return path.resolve(params.reviewDocOutPath, `${params.districtId}.review.md`)
}
