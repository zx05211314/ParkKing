import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadParkingAnswerPreparedIndexSource } from './queryParkingAnswer'

const DEFAULT_DATA_ROOT = 'public/data/generated'
const DEFAULT_INDEX_ROOT = '.tmp/parking-answer-index'

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const readDistrictIds = async (dataRoot: string) => {
  const registryPath = path.join(dataRoot, 'registry.json')
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8')) as {
    districts?: Array<{ districtId?: unknown }>
  }
  return (registry.districts ?? [])
    .map((entry) =>
      typeof entry.districtId === 'string' ? entry.districtId.trim() : '',
    )
    .filter(Boolean)
    .sort()
}

export const buildParkingAnswerIndexes = async (options: {
  dataRoot?: string
  indexRoot?: string
  loadSource?: typeof loadParkingAnswerPreparedIndexSource
}) => {
  const dataRoot = path.resolve(options.dataRoot ?? DEFAULT_DATA_ROOT)
  const indexRoot = path.resolve(options.indexRoot ?? DEFAULT_INDEX_ROOT)
  const districtIds = await readDistrictIds(dataRoot)
  if (districtIds.length === 0) {
    throw new Error(`No districts found in ${path.join(dataRoot, 'registry.json')}`)
  }

  await fs.rm(indexRoot, { recursive: true, force: true })
  await fs.mkdir(indexRoot, { recursive: true })
  const results: Array<{
    districtId: string
    datasetHash: string
    segments: number
    zones: number
    bytes: number
    path: string
  }> = []
  const loadSource =
    options.loadSource ?? loadParkingAnswerPreparedIndexSource

  for (const districtId of districtIds) {
    const prepared = await loadSource(
      path.join(dataRoot, districtId),
    )
    const outputPath = path.join(indexRoot, `${districtId}.json`)
    const content = `${JSON.stringify(prepared)}\n`
    await fs.writeFile(outputPath, content, 'utf-8')
    results.push({
      districtId,
      datasetHash: prepared.datasetHash,
      segments: prepared.segments.length,
      zones: prepared.zones.length,
      bytes: Buffer.byteLength(content),
      path: outputPath,
    })
  }

  return { dataRoot, indexRoot, results }
}

const run = async () => {
  const result = await buildParkingAnswerIndexes({
    dataRoot:
      getArgValue(process.argv, '--data-root', '--dataRoot') ?? DEFAULT_DATA_ROOT,
    indexRoot:
      getArgValue(process.argv, '--index-root', '--indexRoot') ??
      process.env.PARKKING_PARKING_ANSWER_INDEX_ROOT ??
      DEFAULT_INDEX_ROOT,
  })
  console.log('# Parking Answer Indexes: PASS')
  console.log(`- Data root: ${result.dataRoot}`)
  console.log(`- Index root: ${result.indexRoot}`)
  for (const entry of result.results) {
    console.log(
      `- ${entry.districtId}: ${entry.segments} segments, ${entry.zones} zones, ${entry.bytes} bytes, hash ${entry.datasetHash}`,
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
