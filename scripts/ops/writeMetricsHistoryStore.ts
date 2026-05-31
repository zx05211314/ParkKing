import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { metricsHistoryFileExists } from './writeMetricsHistoryFiles'
import {
  HISTORY_MAX_LINES,
  type MetricsHistoryEntry,
} from './writeMetricsHistoryTypes'

export const writeMetricsHistoryFile = async (params: {
  targetPath: string
  entry: MetricsHistoryEntry
  previousPath: string | null
}) => {
  let previousLines: string[] = []
  if (params.previousPath && (await metricsHistoryFileExists(params.previousPath))) {
    const previousContent = await fs.readFile(params.previousPath, 'utf-8')
    previousLines = previousContent
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
  }

  const nextLines = [...previousLines, JSON.stringify(params.entry)]
  const trimmed =
    nextLines.length > HISTORY_MAX_LINES
      ? nextLines.slice(-HISTORY_MAX_LINES)
      : nextLines

  await fs.mkdir(path.dirname(params.targetPath), { recursive: true })
  await fs.writeFile(params.targetPath, `${trimmed.join('\n')}\n`, 'utf-8')
}
