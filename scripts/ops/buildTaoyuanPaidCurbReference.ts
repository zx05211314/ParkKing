import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PAID_CURB_REFERENCE_KIND,
  parsePaidCurbReferencePack,
  type PaidCurbReferencePack,
  type PaidCurbReferenceRecord,
} from '../../src/data/paidCurbReference'
import type { CoverageManifest } from './coverageStatus'

const DEFAULT_INPUT = 'data/sources/taoyuan/paid_curb_segments.xml'
const DEFAULT_MANIFEST = 'configs/coverage.expansion.json'
const DEFAULT_OUTPUT = 'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_REVIEW_DISTRICT = 'taoyuan-district'
const DEFAULT_REVIEW_DIR = '.tmp/taoyuan-human-review'

interface ParsedPaidCurbRecord extends PaidCurbReferenceRecord {
  townId: string
}

const decodeXmlEntities = (value: string) =>
  value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,
    (entity, token: string) => {
      const normalized = token.toLowerCase()
      if (normalized === 'amp') return '&'
      if (normalized === 'lt') return '<'
      if (normalized === 'gt') return '>'
      if (normalized === 'quot') return '"'
      if (normalized === 'apos') return "'"
      const radix = normalized.startsWith('#x') ? 16 : 10
      const digits = normalized.slice(radix === 16 ? 2 : 1)
      const codePoint = Number.parseInt(digits, radix)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
    },
  )

const normalizeXmlText = (value: string) => {
  const unwrapped = value
    .trim()
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
  return decodeXmlEntities(unwrapped).replace(/\s+/g, ' ').trim()
}

const readElement = (block: string, tag: string) => {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`),
  )
  return match ? normalizeXmlText(match[1] ?? '') : null
}

export const parseTaoyuanPaidCurbXml = (xml: string) => {
  if (!xml.includes('<CurbParkingSegmentList>')) {
    throw new Error('Taoyuan paid-curb XML root is missing')
  }

  const blocks = [...xml.matchAll(/<ParkingSegment>([\s\S]*?)<\/ParkingSegment>/g)]
  if (blocks.length === 0) {
    throw new Error('Taoyuan paid-curb XML contains no parking segments')
  }

  const records: ParsedPaidCurbRecord[] = []
  const ids = new Set<string>()
  for (const [index, match] of blocks.entries()) {
    const block = match[1] ?? ''
    const parkingSegmentId = readElement(block, 'ParkingSegmentID') ?? ''
    const description = readElement(block, 'Description') ?? ''
    const townId = readElement(block, 'TownID') ?? ''
    const sourceTownName = readElement(block, 'TownName') ?? ''
    const cityCode = readElement(block, 'CityCode') ?? ''
    const chargingValue = readElement(block, 'HasChargingPoint') ?? ''
    if (!parkingSegmentId || !description || !townId || !sourceTownName) {
      throw new Error(`Paid-curb XML record ${index + 1} is missing required text`)
    }
    if (cityCode !== 'TAO') {
      throw new Error(`Paid-curb XML record ${parkingSegmentId} has cityCode ${cityCode}`)
    }
    if (chargingValue !== '0' && chargingValue !== '1') {
      throw new Error(
        `Paid-curb XML record ${parkingSegmentId} has invalid HasChargingPoint`,
      )
    }
    if (ids.has(parkingSegmentId)) {
      throw new Error(`Duplicate paid-curb segment ID ${parkingSegmentId}`)
    }
    ids.add(parkingSegmentId)
    const fareDescription = readElement(block, 'FareDescription')
    records.push({
      townId,
      parkingSegmentId,
      description,
      fareDescription: fareDescription || null,
      hasChargingPoint: chargingValue === '1',
      sourceTownName,
    })
  }
  return records
}

export const buildTaoyuanPaidCurbReferencePack = (params: {
  xml: string
  sourceRelativePath: string
  manifest: CoverageManifest
}): PaidCurbReferencePack => {
  const records = parseTaoyuanPaidCurbXml(params.xml)
  const region = params.manifest.regions.find(({ regionId }) => regionId === 'taoyuan')
  if (!region || region.answerCapability !== 'paid-curb-reference-only') {
    throw new Error('Coverage manifest is missing the Taoyuan reference-only region')
  }

  const districtsByBoundaryId = new Map(
    region.districts.map((district) => [district.boundaryFeatureId, district]),
  )
  const unknownTownIds = [
    ...new Set(
      records
        .map(({ townId }) => townId)
        .filter((townId) => !districtsByBoundaryId.has(townId)),
    ),
  ]
  if (unknownTownIds.length > 0) {
    throw new Error(`Unknown Taoyuan TownID values: ${unknownTownIds.join(', ')}`)
  }

  const districts = region.districts.map((district) => {
    const districtRecords = records
      .filter(({ townId }) => townId === district.boundaryFeatureId)
      .map(
        ({
          parkingSegmentId,
          description,
          fareDescription,
          hasChargingPoint,
          sourceTownName,
        }) => ({
          parkingSegmentId,
          description,
          fareDescription,
          hasChargingPoint,
          sourceTownName,
        }),
      )
      .sort((left, right) =>
        left.parkingSegmentId < right.parkingSegmentId
          ? -1
          : left.parkingSegmentId > right.parkingSegmentId
            ? 1
            : 0,
      )
    return {
      districtId: district.districtId,
      districtName: district.districtName,
      boundaryFeatureId: district.boundaryFeatureId,
      recordCount: districtRecords.length,
      records: districtRecords,
    }
  })

  return parsePaidCurbReferencePack({
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: PAID_CURB_REFERENCE_KIND,
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: params.sourceRelativePath.replace(/\\/g, '/'),
      sha256: createHash('sha256').update(params.xml).digest('hex'),
      recordCount: records.length,
    },
    districts,
  })
}

const escapeCsv = (value: string | number | boolean | null) => {
  const text = value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const buildReviewCsv = (
  pack: PaidCurbReferencePack,
  districtId: string,
) => {
  const district = pack.districts.find((candidate) => candidate.districtId === districtId)
  if (!district) {
    throw new Error(`Reference pack is missing district ${districtId}`)
  }
  const header = [
    'parking_segment_id',
    'district_id',
    'district_name',
    'description',
    'fare_description',
    'has_charging_point',
    'geometry_available',
    'legal_answer_eligible',
    'source_text_review_status',
    'source_text_review_note',
  ]
  const rows = district.records.map((record) => [
    record.parkingSegmentId,
    district.districtId,
    district.districtName,
    record.description,
    record.fareDescription,
    record.hasChargingPoint,
    false,
    false,
    '',
    '',
  ])
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n')}\r\n`
}

const writeFileIfMissing = async (filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, { encoding: 'utf-8', flag: 'wx' })
    return true
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      return false
    }
    throw error
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const writeTaoyuanPaidCurbReference = async (params: {
  inputPath: string
  manifestPath: string
  outputPath: string
  reviewDistrictId?: string | null
  reviewDir?: string | null
}) => {
  const inputPath = path.resolve(params.inputPath)
  const manifestPath = path.resolve(params.manifestPath)
  const outputPath = path.resolve(params.outputPath)
  const xml = await fs.readFile(inputPath, 'utf-8')
  const manifest = JSON.parse(
    await fs.readFile(manifestPath, 'utf-8'),
  ) as CoverageManifest
  const pack = buildTaoyuanPaidCurbReferencePack({
    xml,
    sourceRelativePath: path.relative(process.cwd(), inputPath),
    manifest,
  })
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(pack)}\n`, 'utf-8')

  const reviewDistrictId = params.reviewDistrictId
  const reviewDir = params.reviewDir ? path.resolve(params.reviewDir) : null
  if (reviewDistrictId && reviewDir) {
    const district = pack.districts.find(
      (candidate) => candidate.districtId === reviewDistrictId,
    )
    if (!district) {
      throw new Error(`Reference pack is missing district ${reviewDistrictId}`)
    }
    await fs.mkdir(reviewDir, { recursive: true })
    const baseName = `${reviewDistrictId}-paid-curb-review`
    const reviewCsv = buildReviewCsv(pack, reviewDistrictId)
    await fs.writeFile(
      path.join(reviewDir, `${baseName}.template.csv`),
      reviewCsv,
      'utf-8',
    )
    await writeFileIfMissing(
      path.join(reviewDir, `${baseName}.csv`),
      reviewCsv,
    )
    await fs.writeFile(
      path.join(reviewDir, `${baseName}.manifest.json`),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          districtId: reviewDistrictId,
          sourceSha256: pack.source.sha256,
          sourceRecordCount: pack.source.recordCount,
          reviewRecordCount: district.recordCount,
          geometryAvailable: false,
          legalAnswerEligible: false,
          allowedStatuses: [
            'APPROVED_SOURCE_TEXT',
            'NEEDS_CORRECTION',
            'UNCLEAR',
          ],
          reviewCsv: `${baseName}.csv`,
          templateCsv: `${baseName}.template.csv`,
        },
        null,
        2,
      )}\n`,
      'utf-8',
    )
    await fs.writeFile(
      path.join(reviewDir, 'README.md'),
      [
        '# Taoyuan paid-curb source review',
        '',
        `Review ${district.recordCount} source rows in ${baseName}.csv.`,
        `The generated ${baseName}.template.csv may be replaced on rebuild; the review CSV is preserved once created.`,
        'Set source_text_review_status to APPROVED_SOURCE_TEXT, NEEDS_CORRECTION, or UNCLEAR.',
        'Approval confirms source transcription only. It does not confirm geometry or parking legality.',
        '',
      ].join('\n'),
      'utf-8',
    )
  }

  return pack
}

const run = async () => {
  const noReview = process.argv.includes('--no-review')
  const reviewDistrictId = noReview
    ? null
    : getArgValue(process.argv, '--review-district') ?? DEFAULT_REVIEW_DISTRICT
  const reviewDir = noReview
    ? null
    : getArgValue(process.argv, '--review-dir') ?? DEFAULT_REVIEW_DIR
  const outputPath = getArgValue(process.argv, '--out') ?? DEFAULT_OUTPUT
  const pack = await writeTaoyuanPaidCurbReference({
    inputPath: getArgValue(process.argv, '--input') ?? DEFAULT_INPUT,
    manifestPath: getArgValue(process.argv, '--manifest') ?? DEFAULT_MANIFEST,
    outputPath,
    reviewDistrictId,
    reviewDir,
  })
  console.log(`Taoyuan paid-curb references: ${pack.source.recordCount}`)
  pack.districts.forEach((district) =>
    console.log(`${district.districtId}: ${district.recordCount}`),
  )
  console.log(`Wrote ${path.resolve(outputPath)}`)
  if (reviewDistrictId && reviewDir) {
    console.log(`Wrote human-review bundle to ${path.resolve(reviewDir)}`)
  }
  console.log('Reference rows are not eligible for geometry or parking legality answers.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
