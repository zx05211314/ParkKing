import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface DebugBundle {
  generatedAt: string
  pack: {
    meta: {
      districtName?: string
      datasetHash?: string
    } | null
  }
  context: {
    hhmm: string
    includeInferred: boolean
  }
  selectedSegment: {
    id: string
    name: string
    tier: string
    allowedNow: string
    reasonCodes?: string[]
    reasons: string[]
    sourceType?: string
    source?: string
    riskTags?: string[]
  } | null
  ranking: {
    distanceMeters: number | null
    breakdown: {
      distanceWeight: number
      tierWeight: number
      confidenceWeight: number
      inferredPenalty: number
      freshnessBonus: number
      zoneDensityPenalty: number
      total: number
    } | null
  }
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const inputIndex = args.findIndex((arg) => arg === '--input' || arg === '-i')
  const outputIndex = args.findIndex((arg) => arg === '--output' || arg === '-o')
  const input = inputIndex >= 0 ? args[inputIndex + 1] : null
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null
  return { input, output }
}

const categorizeReason = (reason: string) => {
  const normalized = reason.toLowerCase()
  if (normalized.includes('zone restriction')) return 'ZONE'
  if (normalized.includes('red curb')) return 'RED_CURB'
  if (normalized.includes('yellow curb')) return 'YELLOW_CURB'
  if (normalized.includes('night parking allowed')) return 'NIGHT_ALLOWED'
  if (normalized.includes('no parking daytime')) return 'DAY_RESTRICT'
  if (normalized.includes('sign override')) return 'SIGN_OVERRIDE'
  if (normalized.includes('unknown marking')) return 'UNKNOWN_MARKING'
  if (normalized.includes('needs statutory')) return 'NEEDS_CHECK'
  if (normalized.includes('inferred candidate')) return 'INFERRED'
  return 'OTHER'
}

const buildReasonCodes = (reasons: string[], reasonCodes?: string[]) => {
  if (reasonCodes && reasonCodes.length > 0) {
    const counts: Record<string, number> = {}
    reasonCodes.forEach((code) => {
      counts[code] = (counts[code] ?? 0) + 1
    })
    const topCodes = Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([code]) => code)
    return { counts, topCodes }
  }

  const counts: Record<string, number> = {}
  reasons.forEach((reason) => {
    const code = categorizeReason(reason)
    counts[code] = (counts[code] ?? 0) + 1
  })
  const topCodes = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([code]) => code)
  return { counts, topCodes }
}

const writeCsv = async (filePath: string, rows: string[][]) => {
  const lines = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8')
}

const run = async () => {
  const { input, output } = parseArgs(process.argv)
  if (!input) {
    throw new Error('Missing --input. Example: npm run debug:aggregate -- --input debug_bundles')
  }

  const inputDir = path.resolve(input)
  const outputDir = output ? path.resolve(output) : inputDir
  await fs.mkdir(outputDir, { recursive: true })

  const entries = await fs.readdir(inputDir)
  const files = entries.filter((file) => file.endsWith('.json'))

  const rows: string[][] = [
    [
      'districtId',
      'datasetHash',
      'hhmm',
      'segmentId',
      'tier',
      'allowedNow',
      'reasonCodes',
      'rankTotal',
      'distanceWeight',
      'tierWeight',
      'confidenceWeight',
      'inferredPenalty',
      'freshnessBonus',
      'zoneDensityPenalty',
      'includeInferred',
    ],
  ]

  const reasonTotals: Record<string, number> = {}

  for (const file of files) {
    const raw = await fs.readFile(path.resolve(inputDir, file), 'utf-8')
    const bundle = JSON.parse(raw) as DebugBundle
    const segment = bundle.selectedSegment
    const breakdown = bundle.ranking.breakdown
    const reasons = segment?.reasons ?? []
    const { counts, topCodes } = buildReasonCodes(reasons, segment?.reasonCodes)

    Object.entries(counts).forEach(([code, count]) => {
      reasonTotals[code] = (reasonTotals[code] ?? 0) + count
    })

    rows.push([
      bundle.pack.meta?.districtName ?? 'unknown',
      bundle.pack.meta?.datasetHash ?? 'unknown',
      bundle.context.hhmm ?? 'unknown',
      segment?.id ?? 'unknown',
      segment?.tier ?? 'unknown',
      segment?.allowedNow ?? 'unknown',
      topCodes.join(';'),
      breakdown ? String(breakdown.total) : '',
      breakdown ? String(breakdown.distanceWeight) : '',
      breakdown ? String(breakdown.tierWeight) : '',
      breakdown ? String(breakdown.confidenceWeight) : '',
      breakdown ? String(breakdown.inferredPenalty) : '',
      breakdown ? String(breakdown.freshnessBonus) : '',
      breakdown ? String(breakdown.zoneDensityPenalty) : '',
      String(bundle.context.includeInferred ?? false),
    ])
  }

  const csvPath = path.resolve(outputDir, 'debug_bundle_summary.csv')
  await writeCsv(csvPath, rows)

  const countsPath = path.resolve(outputDir, 'debug_bundle_reason_counts.json')
  await fs.writeFile(countsPath, `${JSON.stringify(reasonTotals, null, 2)}\n`, 'utf-8')

  console.log(`Wrote ${csvPath}`)
  console.log(`Wrote ${countsPath}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
