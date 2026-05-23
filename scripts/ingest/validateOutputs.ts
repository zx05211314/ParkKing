import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readConfig } from './readConfig'
import { validateOutputDatasets } from './validateOutputDatasets'
import {
  validateIntersectionsReport,
  validateMeta,
  validateMetaFiles,
} from './validateOutputMetadata'
import { resolveValidateOutputPaths } from './validateOutputPaths'

export const validateOutputs = async (config: Awaited<ReturnType<typeof readConfig>>) => {
  const errors: string[] = []
  const paths = resolveValidateOutputPaths(config)

  await validateOutputDatasets({
    config,
    paths,
    errors,
  })

  let meta: Record<string, unknown> | null = null
  try {
    const metaRaw = await fs.readFile(paths.metaPath, 'utf-8')
    meta = JSON.parse(metaRaw) as Record<string, unknown>
    validateMeta(meta, errors)
  } catch {
    errors.push(`[dataset_meta] missing or unreadable at ${paths.metaPath}`)
  }

  if (meta) {
    await validateMetaFiles(paths.baseDir, meta, errors)
  }

  let reportExists = true
  let report: Record<string, unknown> | null = null
  try {
    const reportRaw = await fs.readFile(paths.intersectionsReportPath, 'utf-8')
    report = JSON.parse(reportRaw) as Record<string, unknown>
  } catch {
    reportExists = false
  }

  if (!reportExists) {
    const hasEmbedded = Boolean(meta && meta.intersectionsReport)
    if (!hasEmbedded) {
      errors.push(`[intersections_report] missing at ${paths.intersectionsReportPath}`)
    }
  } else if (report) {
    validateIntersectionsReport(report, errors)
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.join('\n')}`)
  }

  console.log('Validation succeeded.')
}

const run = async () => {
  const config = await readConfig()
  await validateOutputs(config)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
