import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePaidCurbReferencePack } from '../../src/data/paidCurbReference'
import { writeTaoyuanPaidCurbReviewBundles } from './buildTaoyuanPaidCurbReference'

const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_REVIEW_DISTRICT = 'all'
const DEFAULT_REVIEW_DIR = '.tmp/taoyuan-human-review'
const DEFAULT_REVIEW_EVIDENCE_DIR = 'review-evidence/taoyuan'

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const buildTaoyuanPaidCurbReviewBundles = async (options: {
  referencePath?: string
  reviewDistrictId?: string
  reviewDir?: string
  reviewEvidenceDir?: string | null
  refreshApprovedEvidence?: boolean
} = {}) => {
  const referencePath = path.resolve(
    options.referencePath ?? DEFAULT_REFERENCE,
  )
  const pack = parsePaidCurbReferencePack(
    JSON.parse(await fs.readFile(referencePath, 'utf-8')) as unknown,
  )
  const result = await writeTaoyuanPaidCurbReviewBundles({
    pack,
    reviewDistrictId:
      options.reviewDistrictId ?? DEFAULT_REVIEW_DISTRICT,
    reviewDir: options.reviewDir ?? DEFAULT_REVIEW_DIR,
    reviewEvidenceDir:
      options.reviewEvidenceDir === undefined
        ? DEFAULT_REVIEW_EVIDENCE_DIR
        : options.reviewEvidenceDir,
    refreshApprovedEvidence: options.refreshApprovedEvidence,
  })
  return {
    ...result,
    referencePath,
    sourceSha256: pack.source.sha256,
    sourceRecordCount: pack.source.recordCount,
  }
}

const run = async () => {
  const result = await buildTaoyuanPaidCurbReviewBundles({
    referencePath: getArgValue(process.argv, '--reference') ?? undefined,
    reviewDistrictId:
      getArgValue(process.argv, '--review-district') ?? undefined,
    reviewDir: getArgValue(process.argv, '--review-dir') ?? undefined,
    reviewEvidenceDir: process.argv.includes('--no-review-evidence')
      ? null
      : (getArgValue(process.argv, '--review-evidence-dir') ?? undefined),
    refreshApprovedEvidence: process.argv.includes(
      '--refresh-approved-evidence',
    ),
  })
  console.log(`Taoyuan paid-curb review districts: ${result.districtIds.length}`)
  console.log(`Source rows: ${result.sourceRecordCount}`)
  console.log(
    `Seeded approved districts: ${result.seededDistrictIds.join(', ') || 'none'}`,
  )
  console.log(
    `Refreshed approved districts: ${result.refreshedDistrictIds.join(', ') || 'none'}`,
  )
  console.log(`Wrote human-review bundle to ${result.reviewDir}`)
  console.log(
    'Source-text approval does not confirm geometry or parking legality.',
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
