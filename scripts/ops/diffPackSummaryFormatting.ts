import type { PackDiffReport } from './diffPackTypes'

interface SignOverrideMismatchRegression {
  districtId: string
  increase: number
  next: number
  prev: number
}

interface SignOverrideBreakdownChange {
  districtId: string
  total: string
  matchedBySegmentId: string
  matchedBySpatial: string
  unmatchedNamed: string
}

const formatDeltaValue = (
  delta?: { prev: number | null; next: number | null; delta: number | null } | null,
) => {
  if (!delta) {
    return '-'
  }
  const prev = delta.prev ?? '-'
  const next = delta.next ?? '-'
  if (delta.delta === null) {
    return `${prev} -> ${next}`
  }
  const signedDelta =
    delta.delta > 0 ? `+${delta.delta}` : delta.delta < 0 ? `${delta.delta}` : '0'
  return `${prev} -> ${next} (${signedDelta})`
}

const collectSignOverrideMismatchRegressions = (report: PackDiffReport) =>
  report.districts.flatMap((district) =>
    district.issues
      .filter((issue) => issue.code === 'DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE')
      .map((issue) => {
        const metric =
          issue.metric && typeof issue.metric === 'object'
            ? (issue.metric as Record<string, unknown>)
            : null
        const prev =
          metric && typeof metric.prev === 'number' ? metric.prev : null
        const next =
          metric && typeof metric.next === 'number' ? metric.next : null
        const increase =
          metric && typeof metric.increase === 'number' ? metric.increase : null
        if (prev === null || next === null || increase === null) {
          return null
        }
        return {
          districtId: district.districtId,
          prev,
          next,
          increase,
        } satisfies SignOverrideMismatchRegression
      })
      .filter(
        (
          regression,
        ): regression is SignOverrideMismatchRegression => regression !== null,
      ),
  )

const collectSignOverrideBreakdownChanges = (report: PackDiffReport) =>
  report.districts.flatMap((district) => {
    const matchedBySegmentId = district.meta.signOverrideMatchedSegmentCount
    const matchedBySpatial = district.meta.signOverrideSpatialMatchCount
    const unmatchedNamed = district.meta.signOverrideUnmatchedNamedCount
    const total = district.meta.signOverridesCount
    const hasBreakdownData =
      matchedBySegmentId ||
      matchedBySpatial ||
      unmatchedNamed ||
      total
    if (!hasBreakdownData) {
      return []
    }

    const hasChange = [matchedBySegmentId, matchedBySpatial, unmatchedNamed, total].some(
      (delta) =>
        delta &&
        ((delta.prev === null && delta.next !== null) ||
          (delta.prev !== null && delta.next === null) ||
          (delta.delta !== null && delta.delta !== 0)),
    )
    if (!hasChange) {
      return []
    }

    return [
      {
        districtId: district.districtId,
        total: formatDeltaValue(total),
        matchedBySegmentId: formatDeltaValue(matchedBySegmentId),
        matchedBySpatial: formatDeltaValue(matchedBySpatial),
        unmatchedNamed: formatDeltaValue(unmatchedNamed),
      } satisfies SignOverrideBreakdownChange,
    ]
  })

export const formatConsoleSummary = (report: PackDiffReport) => {
  const added = report.summary.districtsAdded.length
  const removed = report.summary.districtsRemoved.length
  const changed = report.summary.totalChangedFiles
  const lines = [
    `Diff summary: ${added} added, ${removed} removed, ${changed} file changes`,
  ]

  report.districts.forEach((district) => {
    const fileChanges =
      district.files.added.length +
      district.files.removed.length +
      district.files.modified.length
    lines.push(
      `${district.districtId}: ${district.severity} (${district.status}, ${fileChanges} file changes)`,
    )
  })

  const mismatchRegressions = collectSignOverrideMismatchRegressions(report)
  if (mismatchRegressions.length > 0) {
    lines.push(
      `Named sign override mismatches increased: ${mismatchRegressions
        .map(
          (regression) =>
            `${regression.districtId} (+${regression.increase}, ${regression.prev} -> ${regression.next})`,
        )
        .join(', ')}`,
    )
  }

  const breakdownChanges = collectSignOverrideBreakdownChanges(report)
  if (breakdownChanges.length > 0) {
    lines.push(
      `Sign override breakdown changed: ${breakdownChanges
        .map(
          (change) =>
            `${change.districtId} (total ${change.total}; direct ${change.matchedBySegmentId}; spatial ${change.matchedBySpatial}; unmatched ${change.unmatchedNamed})`,
        )
        .join(', ')}`,
    )
  }

  return lines.join('\n')
}

export const formatMarkdownSummary = (report: PackDiffReport) => {
  const lines: string[] = []
  lines.push(`# Pack diff report`)
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Prev: ${report.prevPath ?? 'none'}`)
  lines.push(`- Next: ${report.nextPath}`)
  lines.push(`- Districts added: ${report.summary.districtsAdded.length}`)
  lines.push(`- Districts removed: ${report.summary.districtsRemoved.length}`)
  lines.push(`- Total file changes: ${report.summary.totalChangedFiles}`)
  lines.push('')
  lines.push(`| District | Status | Severity | File changes |`)
  lines.push(`| --- | --- | --- | --- |`)
  report.districts.forEach((district) => {
    const fileChanges =
      district.files.added.length +
      district.files.removed.length +
      district.files.modified.length
    lines.push(
      `| ${district.districtId} | ${district.status} | ${district.severity} | ${fileChanges} |`,
    )
  })
  lines.push('')

  const mismatchRegressions = collectSignOverrideMismatchRegressions(report)
  if (mismatchRegressions.length > 0) {
    lines.push(`## Named sign override mismatch regressions`)
    lines.push('')
    lines.push(`| District | Prev | Next | Increase |`)
    lines.push(`| --- | --- | --- | --- |`)
    mismatchRegressions.forEach((regression) => {
      lines.push(
        `| ${regression.districtId} | ${regression.prev} | ${regression.next} | +${regression.increase} |`,
      )
    })
    lines.push('')
  }

  const breakdownChanges = collectSignOverrideBreakdownChanges(report)
  if (breakdownChanges.length > 0) {
    lines.push(`## Sign override breakdown changes`)
    lines.push('')
    lines.push(
      `| District | Total overrides | Matched by segment id | Matched by spatial fallback | Unmatched named |`,
    )
    lines.push(`| --- | --- | --- | --- | --- |`)
    breakdownChanges.forEach((change) => {
      lines.push(
        `| ${change.districtId} | ${change.total} | ${change.matchedBySegmentId} | ${change.matchedBySpatial} | ${change.unmatchedNamed} |`,
      )
    })
    lines.push('')
  }

  return lines.join('\n')
}
