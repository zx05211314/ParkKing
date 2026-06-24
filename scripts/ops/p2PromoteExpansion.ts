import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SOURCE_ROOT = 'configs/expansion'
const DEFAULT_TARGET_ROOT = 'configs/prod'

type PromoteMode = 'dry-run' | 'execute'

interface FilePlan {
  label: string
  sourcePath: string
  targetPath: string
  sourceExists: boolean
  targetExists: boolean
  copied: boolean
}

export interface P2PromoteExpansionOptions {
  districtId?: string | null
  sourceRoot?: string | null
  targetRoot?: string | null
  execute?: boolean | null
  overwrite?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
  json?: boolean | null
}

export interface P2PromoteExpansionInputs {
  districtId: string
  sourceRoot: string
  targetRoot: string
  execute: boolean
  overwrite: boolean
}

export interface P2PromoteExpansionResult {
  pass: boolean
  mode: PromoteMode
  inputs: P2PromoteExpansionInputs
  files: FilePlan[]
  followUpCommands: string[]
  errors: string[]
  warnings: string[]
}

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

export const parseP2PromoteExpansionArgs = (
  argv: string[],
): P2PromoteExpansionOptions => ({
  districtId: getArgValue(argv, '--district', '--district-id', '--districtId'),
  sourceRoot: getArgValue(argv, '--source-root', '--sourceRoot'),
  targetRoot: getArgValue(argv, '--target-root', '--targetRoot'),
  execute: hasFlag(argv, '--execute'),
  overwrite: hasFlag(argv, '--overwrite'),
  outPath: getArgValue(argv, '--out', '--out-path', '--outPath'),
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut', '--json-out-path', '--jsonOutPath') ??
    undefined,
  json: hasFlag(argv, '--json'),
})

export const resolveP2PromoteExpansionInputs = (
  options: P2PromoteExpansionOptions = {},
): P2PromoteExpansionInputs => {
  const districtId = options.districtId?.trim()
  if (!districtId) {
    throw new Error('--district is required')
  }
  return {
    districtId,
    sourceRoot: options.sourceRoot?.trim() || DEFAULT_SOURCE_ROOT,
    targetRoot: options.targetRoot?.trim() || DEFAULT_TARGET_ROOT,
    execute: Boolean(options.execute),
    overwrite: Boolean(options.overwrite),
  }
}

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const readJsonIfExists = async (targetPath: string) => {
  try {
    return JSON.parse(await fs.readFile(targetPath, 'utf-8')) as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const getString = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const validateConfig = (params: {
  districtId: string
  config: Record<string, unknown> | null
  sourcePath: string
}) => {
  const errors: string[] = []
  if (!params.config) {
    errors.push(`Missing expansion config: ${params.sourcePath}`)
    return errors
  }
  if (getString(params.config, 'districtId') !== params.districtId) {
    errors.push(
      `Expansion config districtId must be ${params.districtId}: ${params.sourcePath}`,
    )
  }
  if (
    !params.config.inputs ||
    typeof params.config.inputs !== 'object' ||
    Array.isArray(params.config.inputs)
  ) {
    errors.push(`Expansion config inputs are missing: ${params.sourcePath}`)
  }
  return errors
}

const validateAnswerCases = (params: {
  districtId: string
  answerCases: Record<string, unknown> | null
  sourcePath: string
}) => {
  const errors: string[] = []
  if (!params.answerCases) {
    errors.push(
      `Missing reviewed expansion answer cases: ${params.sourcePath}. Run p0-finalize-review after human review first.`,
    )
    return errors
  }
  if (getString(params.answerCases, 'districtId') !== params.districtId) {
    errors.push(
      `Answer cases districtId must be ${params.districtId}: ${params.sourcePath}`,
    )
  }
  const cases = Array.isArray(params.answerCases.cases) ? params.answerCases.cases : []
  if (cases.length === 0) {
    errors.push(`Answer cases must include at least one reviewed case: ${params.sourcePath}`)
  }
  if (!getString(params.answerCases, 'datasetHash')) {
    errors.push(`Answer cases datasetHash is missing: ${params.sourcePath}`)
  }
  return errors
}

const buildFilePlans = async (inputs: P2PromoteExpansionInputs): Promise<FilePlan[]> => {
  const files = [
    {
      label: 'config',
      sourcePath: path.join(inputs.sourceRoot, `${inputs.districtId}.json`),
      targetPath: path.join(inputs.targetRoot, `${inputs.districtId}.json`),
    },
    {
      label: 'answer cases',
      sourcePath: path.join(inputs.sourceRoot, `${inputs.districtId}.answer-cases.json`),
      targetPath: path.join(inputs.targetRoot, `${inputs.districtId}.answer-cases.json`),
    },
  ]
  return Promise.all(
    files.map(async (file) => ({
      ...file,
      sourceExists: await fileExists(file.sourcePath),
      targetExists: await fileExists(file.targetPath),
      copied: false,
    })),
  )
}

const followUpCommands = (districtId: string) => [
  `npm run ops:check-inputs -- --config configs/prod/${districtId}.json`,
  `npm run ingest:all -- --configs "configs/prod/${districtId}.json" --allowWarn --override "${districtId} reviewed expansion promotion"`,
  `npm run ops:p1-release-readiness -- --district ${districtId} --cases configs/prod/${districtId}.answer-cases.json`,
]

export const runP2PromoteExpansion = async (
  options: P2PromoteExpansionOptions = {},
): Promise<P2PromoteExpansionResult> => {
  const inputs = resolveP2PromoteExpansionInputs(options)
  const files = await buildFilePlans(inputs)
  const errors: string[] = []
  const warnings: string[] = []

  const configPlan = files.find((file) => file.label === 'config')
  const answerCasesPlan = files.find((file) => file.label === 'answer cases')
  if (!configPlan || !answerCasesPlan) {
    throw new Error('Internal promote plan construction failed')
  }

  const config = await readJsonIfExists(configPlan.sourcePath)
  const answerCases = await readJsonIfExists(answerCasesPlan.sourcePath)
  errors.push(
    ...validateConfig({
      districtId: inputs.districtId,
      config,
      sourcePath: configPlan.sourcePath,
    }),
  )
  errors.push(
    ...validateAnswerCases({
      districtId: inputs.districtId,
      answerCases,
      sourcePath: answerCasesPlan.sourcePath,
    }),
  )

  files.forEach((file) => {
    if (file.targetExists && !inputs.overwrite) {
      errors.push(
        `Target ${file.label} already exists: ${file.targetPath}. Pass --overwrite only for an intentional re-promotion.`,
      )
    }
  })

  if (errors.length === 0 && inputs.execute) {
    for (const file of files) {
      await fs.mkdir(path.dirname(file.targetPath), { recursive: true })
      await fs.copyFile(file.sourcePath, file.targetPath)
      file.copied = true
    }
  } else if (errors.length === 0) {
    warnings.push('Dry run only; pass --execute to copy reviewed expansion files to prod.')
  }

  return {
    pass: errors.length === 0,
    mode: inputs.execute ? 'execute' : 'dry-run',
    inputs,
    files,
    followUpCommands: errors.length === 0 ? followUpCommands(inputs.districtId) : [],
    errors,
    warnings,
  }
}

export const renderP2PromoteExpansion = (result: P2PromoteExpansionResult) => {
  const lines = [
    `# P2 Promote Expansion: ${result.pass ? 'PASS' : 'BLOCKED'}`,
    '',
    '## Inputs',
    '',
    `- District: ${result.inputs.districtId}`,
    `- Mode: ${result.mode}`,
    `- Source root: ${result.inputs.sourceRoot}`,
    `- Target root: ${result.inputs.targetRoot}`,
    `- Overwrite: ${result.inputs.overwrite ? 'yes' : 'no'}`,
    '',
    '## Files',
    '',
    '| File | Source | Target | Source exists | Target exists | Copied |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.files.map(
      (file) =>
        `| ${file.label} | ${file.sourcePath} | ${file.targetPath} | ${file.sourceExists ? 'yes' : 'no'} | ${file.targetExists ? 'yes' : 'no'} | ${file.copied ? 'yes' : 'no'} |`,
    ),
    '',
    '## Follow-Up Commands',
    '',
    ...(result.followUpCommands.length > 0
      ? result.followUpCommands.map((command) => `- ${command}`)
      : ['- none']),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
    '',
    '## Warnings',
    '',
    ...(result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ['- none']),
  ]
  return lines.join('\n')
}

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

const run = async () => {
  const options = parseP2PromoteExpansionArgs(process.argv)
  const result = await runP2PromoteExpansion(options)
  const markdown = renderP2PromoteExpansion(result)
  process.stdout.write(
    options.json ? `${JSON.stringify(result, null, 2)}\n` : `${markdown}\n`,
  )
  if (options.outPath) {
    await writeText(path.resolve(options.outPath), `${markdown}\n`)
  }
  if (options.jsonOutPath) {
    await writeText(path.resolve(options.jsonOutPath), `${JSON.stringify(result, null, 2)}\n`)
  }
  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
