import * as path from 'node:path'
import type { ConfigIssue } from './validateConfigTypes'

export const buildValidateConfigSummary = (
  issues: ConfigIssue[],
  cwd = process.cwd(),
) =>
  issues.map((issue) => ({
    config: path.relative(cwd, issue.configPath),
    status: issue.errors.length > 0 ? 'FAIL' : issue.warnings.length > 0 ? 'WARN' : 'OK',
    errors: issue.errors.length,
    warnings: issue.warnings.length,
  }))

export const printValidateConfigIssues = (
  issues: ConfigIssue[],
  logger: Pick<typeof console, 'table' | 'log'> = console,
  cwd = process.cwd(),
) => {
  logger.table(buildValidateConfigSummary(issues, cwd))
  issues.forEach((issue) => {
    if (issue.errors.length > 0 || issue.warnings.length > 0) {
      logger.log(`\n${path.relative(cwd, issue.configPath)}`)
      issue.errors.forEach((error) => logger.log(`  ERROR: ${error}`))
      issue.warnings.forEach((warning) => logger.log(`  WARN: ${warning}`))
    }
  })
}
