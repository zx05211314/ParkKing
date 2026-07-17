import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256Buffer } from './packageReleaseUtils'
import { validateTaoyuanSpatialReference } from './taoyuanExpansionReadiness'

const ARTIFACT_FILE_NAME = 'paid_curb_segments.geojson'
const DEFAULT_INPUT = '.tmp/taoyuan-spatial-reference'
const DEFAULT_OUTPUT = 'data/sources/taoyuan/paid_curb_segments.geojson'
const DEFAULT_RECEIPT = '.tmp/taoyuan-spatial-reference-install.json'

export interface InstallTaoyuanSpatialReferenceOptions {
  inputPath?: string | null
  outputPath?: string | null
  receiptPath?: string | null
  now?: Date
}

export interface TaoyuanSpatialReferenceInstallReceipt {
  schemaVersion: 1
  installedAt: string
  source: {
    path: string
    sha256: string
    bytes: number
  }
  destination: {
    path: string
    sha256: string
  }
  validation: {
    sourceDataset: 'TDX OnStreet ParkingSegment v1'
    legalAnswerEligible: false
    featureCount: number
    segmentGeometryCount: number
    representativePointCount: number
  }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const portablePath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return (relative || '.').replace(/\\/g, '/')
}

const resolveArtifactPath = async (inputPath: string) => {
  const resolved = path.resolve(inputPath)
  const stat = await fs.stat(resolved)
  return stat.isDirectory() ? path.join(resolved, ARTIFACT_FILE_NAME) : resolved
}

const replaceFileAtomically = async (targetPath: string, buffer: Buffer) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${suffix}`,
  )
  const backupPath = `${targetPath}.bak-${suffix}`
  let backedUp = false

  await fs.writeFile(temporaryPath, buffer)
  try {
    try {
      await fs.rename(targetPath, backupPath)
      backedUp = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    await fs.rename(temporaryPath, targetPath)
    if (backedUp) {
      await fs.rm(backupPath, { force: true })
    }
  } catch (error) {
    await fs.rm(temporaryPath, { force: true })
    if (backedUp) {
      await fs.rename(backupPath, targetPath)
    }
    throw error
  }
}

export const installTaoyuanSpatialReference = async (
  options: InstallTaoyuanSpatialReferenceOptions = {},
) => {
  const inputPath = await resolveArtifactPath(
    options.inputPath ?? DEFAULT_INPUT,
  )
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT)
  const receiptPath = path.resolve(options.receiptPath ?? DEFAULT_RECEIPT)
  const buffer = await fs.readFile(inputPath)
  let payload: unknown
  try {
    payload = JSON.parse(buffer.toString('utf-8')) as unknown
  } catch (error) {
    throw new Error(
      `Taoyuan spatial artifact is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const validation = validateTaoyuanSpatialReference(payload)
  if (!validation.valid) {
    throw new Error(
      `Taoyuan spatial artifact failed validation:\n${validation.errors
        .map((error) => `- ${error}`)
        .join('\n')}`,
    )
  }

  const sha256 = sha256Buffer(buffer)
  const receipt: TaoyuanSpatialReferenceInstallReceipt = {
    schemaVersion: 1,
    installedAt: (options.now ?? new Date()).toISOString(),
    source: {
      path: portablePath(inputPath),
      sha256,
      bytes: buffer.length,
    },
    destination: {
      path: portablePath(outputPath),
      sha256,
    },
    validation: {
      sourceDataset: 'TDX OnStreet ParkingSegment v1',
      legalAnswerEligible: false,
      featureCount: validation.featureCount,
      segmentGeometryCount: validation.segmentGeometryCount,
      representativePointCount: validation.representativePointCount,
    },
  }

  await replaceFileAtomically(outputPath, buffer)
  await replaceFileAtomically(
    receiptPath,
    Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf-8'),
  )

  return { inputPath, outputPath, receiptPath, receipt }
}

const run = async () => {
  const result = await installTaoyuanSpatialReference({
    inputPath: getArgValue(process.argv, '--input'),
    outputPath: getArgValue(process.argv, '--out'),
    receiptPath: getArgValue(process.argv, '--receipt'),
  })
  console.log(
    `Installed ${result.receipt.validation.featureCount} Taoyuan paid-curb reference features to ${result.outputPath}`,
  )
  console.log(`SHA-256: ${result.receipt.source.sha256}`)
  console.log(`Receipt: ${result.receiptPath}`)
  console.log('Legal-answer eligibility remains false.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
