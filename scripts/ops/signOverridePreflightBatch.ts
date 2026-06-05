import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { formatSignOverridePreflight } from './signOverridePreflightOutput'
import { buildSignOverridePreflight } from './signOverridePreflightState'
import type { SignOverridePreflightResult } from './signOverridePreflightTypes'

export interface SignOverridePreflightBatchOptions {
  configsGlob?: string
  outDir?: string
  json?: boolean
  allowMissing?: boolean
}

export interface SignOverridePreflightBatchItem {
  configPath: string
  outPath: string | null
  result: SignOverridePreflightResult
}

export interface SignOverridePreflightBatchResult {
  configsGlob: string
  configPaths: string[]
  items: SignOverridePreflightBatchItem[]
  errors: string[]
  hasErrors: boolean
}

export interface SignOverridePreflightBatchRunners {
  buildPreflight: (configPath: string) => Promise<SignOverridePreflightResult>
}

const DEFAULT_CONFIGS_GLOB = 'configs/prod/*.json'

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

export const parseSignOverridePreflightBatchArgs = (
  argv: string[],
): SignOverridePreflightBatchOptions => ({
  configsGlob:
    getArgValue(argv, '--configs', '--config-glob', '--configsGlob') ??
    DEFAULT_CONFIGS_GLOB,
  outDir: getArgValue(argv, '--out-dir', '--outDir') ?? undefined,
  json: hasFlag(argv, '--json'),
  allowMissing: hasFlag(argv, '--allow-missing', '--allowMissing'),
})

export const resolveSignOverridePreflightConfigPaths = async (
  configsGlob = DEFAULT_CONFIGS_GLOB,
) =>
  (
    await fg(configsGlob, {
      onlyFiles: true,
      dot: false,
      absolute: false,
    })
  )
    .filter((configPath) => !configPath.endsWith('.answer-cases.json'))
    .sort((a, b) => a.localeCompare(b))

const outputPathForConfig = (params: {
  configPath: string
  outDir?: string
  json?: boolean
}) => {
  if (!params.outDir) {
    return null
  }
  const stem = path.basename(params.configPath, path.extname(params.configPath))
  return path.join(params.outDir, `${stem}.${params.json ? 'json' : 'md'}`)
}

const renderPreflight = (result: SignOverridePreflightResult, json?: boolean) =>
  json ? JSON.stringify(result, null, 2) : formatSignOverridePreflight(result)

const defaultRunners: SignOverridePreflightBatchRunners = {
  buildPreflight: (configPath) => buildSignOverridePreflight(configPath),
}

export const runSignOverridePreflightBatch = async (
  options: SignOverridePreflightBatchOptions = {},
  runners: SignOverridePreflightBatchRunners = defaultRunners,
): Promise<SignOverridePreflightBatchResult> => {
  const configsGlob = options.configsGlob ?? DEFAULT_CONFIGS_GLOB
  const configPaths = await resolveSignOverridePreflightConfigPaths(configsGlob)
  const errors: string[] = []
  const items: SignOverridePreflightBatchItem[] = []

  if (configPaths.length === 0 && !options.allowMissing) {
    errors.push(`No configs matched: ${configsGlob}`)
  }

  for (const configPath of configPaths) {
    try {
      const result = await runners.buildPreflight(configPath)
      const outPath = outputPathForConfig({
        configPath,
        outDir: options.outDir,
        json: options.json,
      })
      const output = renderPreflight(result, options.json)
      if (outPath) {
        const resolved = path.resolve(outPath)
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        await fs.writeFile(resolved, `${output}\n`, 'utf-8')
      }
      items.push({ configPath, outPath, result })
    } catch (error) {
      errors.push(
        `${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return {
    configsGlob,
    configPaths,
    items,
    errors,
    hasErrors: errors.length > 0,
  }
}

export const renderSignOverridePreflightBatchResult = (
  result: SignOverridePreflightBatchResult,
) => {
  const lines = [
    `Sign override preflight batch: ${result.hasErrors ? 'FAIL' : 'PASS'}`,
    `Configs: ${result.configsGlob}`,
    `Matched configs: ${result.configPaths.length}`,
  ]

  result.items.forEach((item) => {
    lines.push(
      `- ${item.result.districtId}: effective ${item.result.effectiveOverrides}, matched ${item.result.matchedSegmentOverrides}, missing ${item.result.missingSegmentOverrides}${item.outPath ? `, wrote ${item.outPath}` : ''}`,
    )
  })
  result.errors.forEach((error) => {
    lines.push(`ERROR: ${error}`)
  })

  return lines.join('\n')
}

const run = async () => {
  const result = await runSignOverridePreflightBatch(
    parseSignOverridePreflightBatchArgs(process.argv),
  )
  console.log(renderSignOverridePreflightBatchResult(result))
  if (result.hasErrors) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
