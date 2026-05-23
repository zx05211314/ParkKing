import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'
import { fileURLToPath } from 'node:url'
import { parseValidateConfigArgs } from './validateConfigArgs'
import { buildValidateConfigSummary, printValidateConfigIssues } from './validateConfigOutput'
import { normalizeConfigPath } from './validateConfigPaths'
import type { ConfigIssue, ValidateOptions } from './validateConfigTypes'
import { validateConfigIssue } from './validateConfigValidation'

const isDistrictConfigPath = (filePath: string) =>
  !path.basename(filePath).toLowerCase().startsWith('sources.') &&
  !path.basename(filePath).toLowerCase().endsWith('.answer-cases.json')

export const validateConfigs = async (options: ValidateOptions = {}) => {
  const discoveredFiles = options.configsGlob
    ? await fg(options.configsGlob, { onlyFiles: true, dot: false, absolute: true })
    : await (async () => {
        const configsDir = options.configsDir ?? 'configs'
        const pattern = normalizeConfigPath(path.resolve(configsDir)).replace(/\\/g, '/')
        return fg(`${pattern}/**/*.json`, { onlyFiles: true, dot: false })
      })()
  const files = discoveredFiles.filter(isDistrictConfigPath)
  const issues: ConfigIssue[] = []

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      issues.push(validateConfigIssue(filePath, parsed, options))
    } catch {
      issues.push({
        configPath: filePath,
        errors: ['invalid JSON'],
        warnings: [],
      })
    }
  }

  buildValidateConfigSummary(issues)
  printValidateConfigIssues(issues)

  const hasErrors = issues.some((issue) => issue.errors.length > 0)
  return { issues, hasErrors }
}

const run = async () => {
  const args = parseValidateConfigArgs(process.argv)
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
