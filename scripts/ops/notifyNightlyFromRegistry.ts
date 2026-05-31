import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNotifyNightlyArgs } from './notifyNightlyArgs'
import { runNotifyNightly } from './notifyNightly'
import type { NotifyNightlyArgs } from './notifyNightlyTypes'

export interface NotifyNightlyFromRegistryOptions {
  registryPath?: string
  root?: string
  notifyArgv?: string[]
}

export interface NotifyNightlyFromRegistryRunners {
  notifyNightly: (args: NotifyNightlyArgs) => Promise<void>
}

export interface NotifyNightlyFromRegistryResult {
  registryPath: string
  root: string
  districtIds: string[]
  diffInputs: string[]
  skipped: boolean
}

const DEFAULT_REGISTRY_PATH = 'public/data/generated/registry.json'
const DEFAULT_ROOT = 'public/data/generated'

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const stripWrapperArgs = (argv: string[]) => {
  const stripped: string[] = []
  const flagsWithValue = new Set([
    '--registry',
    '--registry-path',
    '--registryPath',
    '--root',
    '--data-root',
    '--dataRoot',
  ])

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (flagsWithValue.has(value)) {
      index += 1
      continue
    }
    stripped.push(value)
  }
  return stripped
}

export const parseNotifyNightlyFromRegistryArgs = (
  argv: string[],
): NotifyNightlyFromRegistryOptions => ({
  registryPath:
    getArgValue(argv, '--registry', '--registry-path', '--registryPath') ??
    DEFAULT_REGISTRY_PATH,
  root: getArgValue(argv, '--root', '--data-root', '--dataRoot') ?? DEFAULT_ROOT,
  notifyArgv: stripWrapperArgs(argv),
})

const assertSafeDistrictId = (districtId: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(districtId)) {
    throw new Error(`Invalid district id in registry: ${districtId}`)
  }
}

export const loadNotifyNightlyRegistryDistricts = async (registryPath: string) => {
  const raw = await fs.readFile(registryPath, 'utf-8')
  const parsed = JSON.parse(raw) as { districts?: Array<{ districtId?: unknown }> }
  if (!Array.isArray(parsed.districts)) {
    throw new Error(`Registry is missing districts array: ${registryPath}`)
  }

  return parsed.districts.map((entry, index) => {
    if (typeof entry.districtId !== 'string' || entry.districtId.trim() === '') {
      throw new Error(`Registry district at index ${index} is missing districtId`)
    }
    const districtId = entry.districtId.trim()
    assertSafeDistrictId(districtId)
    return districtId
  })
}

export const buildNotifyNightlyDiffInputsFromDistricts = (
  root: string,
  districtIds: string[],
) => districtIds.map((districtId) => path.join(root, districtId))

export const buildNotifyNightlyArgsFromRegistry = (params: {
  diffInputs: string[]
  notifyArgv?: string[]
}) =>
  parseNotifyNightlyArgs([
    'node',
    'notifyNightly.ts',
    ...params.diffInputs.flatMap((diffInput) => ['--diff', diffInput]),
    ...(params.notifyArgv ?? []),
  ])

export const runNotifyNightlyFromRegistry = async (
  options: NotifyNightlyFromRegistryOptions = {},
  runners: NotifyNightlyFromRegistryRunners = { notifyNightly: runNotifyNightly },
): Promise<NotifyNightlyFromRegistryResult> => {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH
  const root = options.root ?? DEFAULT_ROOT
  const districtIds = await loadNotifyNightlyRegistryDistricts(registryPath)
  const diffInputs = buildNotifyNightlyDiffInputsFromDistricts(root, districtIds)

  if (diffInputs.length === 0) {
    console.log('No districts found for notify-nightly.')
    return {
      registryPath,
      root,
      districtIds,
      diffInputs,
      skipped: true,
    }
  }

  await runners.notifyNightly(
    buildNotifyNightlyArgsFromRegistry({
      diffInputs,
      notifyArgv: options.notifyArgv,
    }),
  )

  return {
    registryPath,
    root,
    districtIds,
    diffInputs,
    skipped: false,
  }
}

const run = async () => {
  const result = await runNotifyNightlyFromRegistry(
    parseNotifyNightlyFromRegistryArgs(process.argv),
  )
  console.log(
    `notify-nightly registry districts: ${result.districtIds.length} from ${result.registryPath}`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
