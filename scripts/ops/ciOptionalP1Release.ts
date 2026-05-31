import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runP1ReleaseReadiness,
  renderP1ReleaseReadiness,
  type P1ReleaseReadinessOptions,
  type P1ReleaseReadinessResult,
} from './p1ReleaseReadiness'
import {
  packageRelease,
  renderPackageReleaseResult,
  type PackageReleaseResult,
} from './packageRelease'
import {
  validateReleasePackage,
  renderValidateReleasePackageResult,
  type ValidateReleasePackageResult,
} from './validateReleasePackage'

export interface CiOptionalP1ReleaseOptions {
  districtId?: string | null
  root?: string | null
  registryPath?: string | null
  configGlob?: string | null
  timeoutMs?: number | null
  outDir?: string | null
  markdownOutPath?: string | null
  jsonOutPath?: string | null
}

export interface CiOptionalP1ReleaseResult {
  status: 'skipped' | 'passed' | 'failed'
  districtId: string
  root: string
  registryPath: string
  reason: string | null
  readiness: P1ReleaseReadinessResult | null
  releasePackage: PackageReleaseResult | null
  packageValidation: ValidateReleasePackageResult | null
  errors: string[]
}

export interface CiOptionalP1ReleaseRunners {
  fileExists: (filePath: string) => Promise<boolean>
  runP1ReleaseReadiness: (
    options: P1ReleaseReadinessOptions,
  ) => Promise<P1ReleaseReadinessResult>
  packageRelease: typeof packageRelease
  validateReleasePackage: typeof validateReleasePackage
}

const DEFAULT_DISTRICT = 'xinyi'
const DEFAULT_ROOT = 'public/data/generated'
const DEFAULT_CONFIG_GLOB = 'configs/prod/*.json'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_OUT_DIR = 'dist/releases'
const DEFAULT_MARKDOWN_OUT = '.tmp/p1-release-package.md'
const DEFAULT_JSON_OUT = '.tmp/p1-release-package.json'

const defaultRunners: CiOptionalP1ReleaseRunners = {
  fileExists: async (filePath) => {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },
  runP1ReleaseReadiness,
  packageRelease,
  validateReleasePackage,
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

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

export const parseCiOptionalP1ReleaseArgs = (
  argv: string[],
): CiOptionalP1ReleaseOptions => ({
  districtId: getArgValue(argv, '--district', '--district-id', '--districtId'),
  root: getArgValue(argv, '--root', '--public-root', '--publicRoot'),
  registryPath: getArgValue(argv, '--registry', '--registry-path', '--registryPath'),
  configGlob: getArgValue(argv, '--configs', '--config-glob', '--configGlob'),
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? null,
  outDir: getArgValue(argv, '--out-dir', '--outDir'),
  markdownOutPath: getArgValue(argv, '--out', '--markdown-out', '--markdownOut'),
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
})

const resolveOptions = (options: CiOptionalP1ReleaseOptions) => {
  const districtId = options.districtId?.trim() || DEFAULT_DISTRICT
  const root = options.root?.trim() || DEFAULT_ROOT
  return {
    districtId,
    root,
    registryPath:
      options.registryPath?.trim() || path.join(root, 'registry.json'),
    configGlob: options.configGlob?.trim() || DEFAULT_CONFIG_GLOB,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    outDir: options.outDir?.trim() || DEFAULT_OUT_DIR,
    markdownOutPath: options.markdownOutPath?.trim() || DEFAULT_MARKDOWN_OUT,
    jsonOutPath: options.jsonOutPath?.trim() || DEFAULT_JSON_OUT,
  }
}

export const runCiOptionalP1Release = async (
  options: CiOptionalP1ReleaseOptions = {},
  runners: CiOptionalP1ReleaseRunners = defaultRunners,
): Promise<CiOptionalP1ReleaseResult> => {
  const inputs = resolveOptions(options)
  const registryExists = await runners.fileExists(inputs.registryPath)

  if (!registryExists) {
    return {
      status: 'skipped',
      districtId: inputs.districtId,
      root: inputs.root,
      registryPath: inputs.registryPath,
      reason:
        'Generated release registry is absent in this checkout; run publish ingest before product release packaging.',
      readiness: null,
      releasePackage: null,
      packageValidation: null,
      errors: [],
    }
  }

  const errors: string[] = []
  let readiness: P1ReleaseReadinessResult | null = null
  let releasePackage: PackageReleaseResult | null = null
  let packageValidation: ValidateReleasePackageResult | null = null

  try {
    readiness = await runners.runP1ReleaseReadiness({
      districtId: inputs.districtId,
      root: inputs.root,
      registryPath: inputs.registryPath,
      configGlob: inputs.configGlob,
      timeoutMs: inputs.timeoutMs,
    })
    if (!readiness.pass) {
      errors.push(...readiness.blockers)
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  if (errors.length === 0) {
    try {
      releasePackage = await runners.packageRelease({
        outDir: inputs.outDir,
        includeGlob: path.join(inputs.root, inputs.districtId, '**').replace(/\\/g, '/'),
        registryPath: inputs.registryPath,
        districtIds: [inputs.districtId],
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (errors.length === 0 && releasePackage) {
    try {
      packageValidation = await runners.validateReleasePackage({
        zipPath: releasePackage.zipPath,
        manifestPath: releasePackage.manifestPath,
        districtIds: [inputs.districtId],
      })
      if (!packageValidation.pass) {
        errors.push(...packageValidation.errors)
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    status: errors.length > 0 ? 'failed' : 'passed',
    districtId: inputs.districtId,
    root: inputs.root,
    registryPath: inputs.registryPath,
    reason: null,
    readiness,
    releasePackage,
    packageValidation,
    errors,
  }
}

export const renderCiOptionalP1Release = (
  result: CiOptionalP1ReleaseResult,
) => {
  const lines = [
    `# CI Optional P1 Release Package: ${result.status.toUpperCase()}`,
    '',
    `- District: ${result.districtId}`,
    `- Root: ${result.root}`,
    `- Registry: ${result.registryPath}`,
    '',
  ]

  if (result.reason) {
    lines.push('## Reason', '', `- ${result.reason}`, '')
  }
  if (result.readiness) {
    lines.push('## P1 Release Readiness', '', renderP1ReleaseReadiness(result.readiness), '')
  }
  if (result.releasePackage) {
    lines.push('## Release Package', '', renderPackageReleaseResult(result.releasePackage), '')
  }
  if (result.packageValidation) {
    lines.push(
      '## Release Package Validation',
      '',
      renderValidateReleasePackageResult(result.packageValidation),
      '',
    )
  }
  lines.push(
    '## Wrapper Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
  )

  return lines.join('\n')
}

export const writeCiOptionalP1ReleaseOutputs = async (
  result: CiOptionalP1ReleaseResult,
  options: Pick<CiOptionalP1ReleaseOptions, 'markdownOutPath' | 'jsonOutPath'>,
) => {
  const resolved = resolveOptions(options)
  await fs.mkdir(path.dirname(path.resolve(resolved.markdownOutPath)), {
    recursive: true,
  })
  await fs.writeFile(
    path.resolve(resolved.markdownOutPath),
    `${renderCiOptionalP1Release(result)}\n`,
    'utf-8',
  )
  await fs.mkdir(path.dirname(path.resolve(resolved.jsonOutPath)), {
    recursive: true,
  })
  await fs.writeFile(
    path.resolve(resolved.jsonOutPath),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf-8',
  )
}

const run = async () => {
  const options = parseCiOptionalP1ReleaseArgs(process.argv)
  const result = await runCiOptionalP1Release(options)
  await writeCiOptionalP1ReleaseOutputs(result, options)
  console.log(renderCiOptionalP1Release(result))
  if (result.status === 'failed') {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
