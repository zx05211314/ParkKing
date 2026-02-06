import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'
import { fileURLToPath } from 'node:url'

interface ConfigIssue {
  configPath: string
  errors: string[]
  warnings: string[]
}

interface ValidateOptions {
  configsDir?: string
  configsGlob?: string
  allowAbsolute?: boolean
}

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const dirIndex = args.findIndex((arg) => arg === '--dir')
  const globIndex = args.findIndex((arg) => arg === '--configs')
  const allowAbsolute = args.includes('--allowAbsolute')
  return {
    configsDir: dirIndex >= 0 ? args[dirIndex + 1] : null,
    configsGlob: globIndex >= 0 ? args[globIndex + 1] : null,
    allowAbsolute,
  }
}

const normalizePath = (value: string) => value.replace(/\\/g, '/')

const isHomePath = (value: string) => {
  const home = process.env.HOME || process.env.USERPROFILE
  if (!home) {
    return false
  }
  const normalized = normalizePath(path.resolve(value))
  const normalizedHome = normalizePath(path.resolve(home))
  return normalized.startsWith(normalizedHome)
}

const isDriveRoot = (value: string) => {
  const resolved = path.resolve(value)
  const root = path.parse(resolved).root
  return resolved === root
}

const isRelative = (value: string) => !path.isAbsolute(value)

const validatePath = (
  value: string,
  allowAbsolute: boolean,
  errors: string[],
  label: string,
) => {
  if (!allowAbsolute && !isRelative(value)) {
    errors.push(`${label} must be a relative path`)
  }
  if (path.isAbsolute(value)) {
    if (isHomePath(value)) {
      errors.push(`${label} must not point to a user home directory`)
    }
    if (isDriveRoot(value)) {
      errors.push(`${label} must not point to a drive root`)
    }
  }
}

const validateConfig = (
  configPath: string,
  config: Record<string, unknown>,
  options: ValidateOptions,
): ConfigIssue => {
  const errors: string[] = []
  const warnings: string[] = []

  const districtId = config.districtId as string | undefined
  const districtName = config.districtName as string | undefined
  if (!districtId) {
    errors.push('districtId is required')
  }
  if (!districtName) {
    errors.push('districtName is required')
  }

  const inputs = config.inputs as Record<string, unknown> | undefined
  if (!inputs) {
    errors.push('inputs section is required')
  }

  const ciSafe = config.ciSafe === true
  const inputEntries = inputs ? Object.entries(inputs) : []
  inputEntries.forEach(([key, value]) => {
    if (!value) {
      return
    }
    if (typeof value !== 'string') {
      errors.push(`inputs.${key} must be a string path`)
      return
    }
    validatePath(value, Boolean(options.allowAbsolute), errors, `inputs.${key}`)
    if (ciSafe) {
      const normalized = normalizePath(value)
      const allowedPrefixes = ['tests/fixtures/', '../tests/fixtures/']
      if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
        errors.push(`inputs.${key} must live under tests/fixtures/ for ciSafe`)
      }
    }
  })

  const outputs = config.outputs as Record<string, unknown> | undefined
  const outputsDistrictId = outputs?.districtId as string | undefined
  if (outputsDistrictId && districtId && outputsDistrictId !== districtId) {
    errors.push('outputs.districtId must match districtId')
  }

  const checkOutputDir = (field: string) => {
    const value = outputs?.[field]
    if (!value) {
      return
    }
    if (typeof value !== 'string') {
      errors.push(`outputs.${field} must be a string path`)
      return
    }
    validatePath(value, Boolean(options.allowAbsolute), errors, `outputs.${field}`)
    if (districtId) {
      const normalized = path.normalize(value)
      if (!normalized.endsWith(`${path.sep}${districtId}`)) {
        errors.push(`outputs.${field} must end with /${districtId}`)
      }
    } else {
      warnings.push(`outputs.${field} cannot be checked without districtId`)
    }
  }

  checkOutputDir('generatedDir')
  checkOutputDir('publicDir')

  if (!config.ops) {
    warnings.push('ops section missing; defaults will be used')
  } else if (!config.ops.thresholds) {
    warnings.push('ops.thresholds missing; defaults will be used')
  }

  return {
    configPath,
    errors,
    warnings,
  }
}

export const validateConfigs = async (options: ValidateOptions = {}) => {
  const files = options.configsGlob
    ? await fg(options.configsGlob, { onlyFiles: true, dot: false, absolute: true })
    : await (async () => {
        const configsDir = options.configsDir ?? 'configs'
        const pattern = normalizePath(path.resolve(configsDir)).replace(/\\/g, '/')
        return fg(`${pattern}/**/*.json`, { onlyFiles: true, dot: false })
      })()
  const issues: ConfigIssue[] = []

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      issues.push(validateConfig(filePath, parsed, options))
    } catch {
      issues.push({
        configPath: filePath,
        errors: ['invalid JSON'],
        warnings: [],
      })
    }
  }

  const summary = issues.map((issue) => ({
    config: path.relative(process.cwd(), issue.configPath),
    status: issue.errors.length > 0 ? 'FAIL' : issue.warnings.length > 0 ? 'WARN' : 'OK',
    errors: issue.errors.length,
    warnings: issue.warnings.length,
  }))

  console.table(summary)
  issues.forEach((issue) => {
    if (issue.errors.length > 0 || issue.warnings.length > 0) {
      console.log(`\n${path.relative(process.cwd(), issue.configPath)}`)
      issue.errors.forEach((error) => console.log(`  ERROR: ${error}`))
      issue.warnings.forEach((warning) => console.log(`  WARN: ${warning}`))
    }
  })

  const hasErrors = issues.some((issue) => issue.errors.length > 0)
  return { issues, hasErrors }
}

const run = async () => {
  const args = parseArgs(process.argv)
  const result = await validateConfigs({
    configsDir: args.configsDir ?? undefined,
    configsGlob: args.configsGlob ?? undefined,
    allowAbsolute: args.allowAbsolute,
  })
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
