import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { PublishGateRunSummary } from './publishGateRunSummary'

const ensurePublishGateOpsDir = async (baseDir: string) => {
  const opsDir = path.resolve(baseDir, '_ops')
  await fs.mkdir(opsDir, { recursive: true })
  return opsDir
}

export const writePublishGateSummaryFile = async (
  baseDir: string,
  summary: PublishGateRunSummary,
) => {
  const opsDir = await ensurePublishGateOpsDir(baseDir)
  const summaryPath = path.resolve(opsDir, 'publish_gate_summary.json')
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8')
}

const formatBooleanLabel = (value: boolean) => (value ? 'yes' : 'no')

const formatNullableCount = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : String(value)

export const buildPublishGateSummaryMarkdown = (
  summary: PublishGateRunSummary,
) => {
  const lines: string[] = []
  lines.push('# Publish gate summary')
  lines.push('')
  lines.push(`- Generated: ${summary.generatedAt}`)
  lines.push(`- Report: ${summary.reportPath}`)
  lines.push(`- Mode: ${summary.mode}`)
  lines.push(`- Exit code: ${summary.exitCode}`)
  lines.push(`- Allow WARN: ${formatBooleanLabel(summary.allowWarn)}`)
  lines.push(`- Allow FAIL: ${formatBooleanLabel(summary.allowFail)}`)
  lines.push(
    `- Allow baseline adopt: ${formatBooleanLabel(summary.allowBaselineAdopt)}`,
  )
  if (summary.overrideReason) {
    lines.push(`- Override reason: ${summary.overrideReason}`)
  }
  if (summary.gateMessageFlags.length > 0) {
    lines.push(`- Flags: ${summary.gateMessageFlags.join(', ')}`)
  }
  lines.push('')
  lines.push('## Totals')
  lines.push('')
  lines.push('| INFO | WARN | FAIL |')
  lines.push('| --- | --- | --- |')
  lines.push(`| ${summary.totals.info} | ${summary.totals.warn} | ${summary.totals.fail} |`)

  if (summary.districts.length > 0) {
    lines.push('')
    lines.push('## Districts')
    lines.push('')
    lines.push(
      '| District | INFO | WARN | FAIL | Top WARN codes | Top FAIL codes | Direct overrides | Spatial overrides | Unmatched named |',
    )
    lines.push(
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    )
    summary.districts.forEach((district) => {
      lines.push(
        `| ${district.districtId} | ${district.info} | ${district.warn} | ${district.fail} | ${district.topWarnCodes.join(', ') || '-'} | ${district.topFailCodes.join(', ') || '-'} | ${formatNullableCount(district.signOverrideBreakdown?.matchedBySegmentId)} | ${formatNullableCount(district.signOverrideBreakdown?.matchedBySpatial)} | ${formatNullableCount(district.signOverrideBreakdown?.unmatchedNamed)} |`,
      )
    })
  }

  if (summary.baselineAdopt.applied || summary.bootstrap.modeUsed) {
    lines.push('')
    lines.push('## Gate decisions')
    lines.push('')
    lines.push(
      `- Bootstrap mode used: ${formatBooleanLabel(summary.bootstrap.modeUsed)}`,
    )
    lines.push(
      `- Baseline adopt applied: ${formatBooleanLabel(summary.baselineAdopt.applied)}`,
    )
    if (summary.baselineAdopt.districtIds.length > 0) {
      lines.push(
        `- Baseline adopt districts: ${summary.baselineAdopt.districtIds.join(', ')}`,
      )
    }
  }

  return `${lines.join('\n')}\n`
}

export const writePublishGateSummaryMarkdownFile = async (
  baseDir: string,
  summary: PublishGateRunSummary,
) => {
  const opsDir = await ensurePublishGateOpsDir(baseDir)
  const summaryPath = path.resolve(opsDir, 'publish_gate_summary.md')
  await fs.writeFile(
    summaryPath,
    buildPublishGateSummaryMarkdown(summary),
    'utf-8',
  )
}

export const appendPublishGateLog = async (
  baseDir: string,
  fileName: string,
  payload: Record<string, unknown>,
) => {
  const opsDir = await ensurePublishGateOpsDir(baseDir)
  const logPath = path.resolve(opsDir, fileName)
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8')
}
