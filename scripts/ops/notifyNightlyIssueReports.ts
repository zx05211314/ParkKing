import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectSyncIssueReportDistrictSummaries } from './issueReportSummaryState'
import { normalizeSyncText, resolveSyncServiceConfig } from './syncServiceConfig'
import { readSyncStoreFile } from './syncServiceFileStore'
import type { SyncServiceStore } from './syncServiceTypes'
import type { NightlyIssueReportSummary } from './notifyNightlyTypes'

const nightlyFileExists = async (filePath: string) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export const collectNightlyIssueReports = (
  store: SyncServiceStore,
): NightlyIssueReportSummary[] => collectSyncIssueReportDistrictSummaries(store)

export const loadNightlyIssueReports = async (
  syncStorePath: string | null,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<NightlyIssueReportSummary[]> => {
  const config = resolveSyncServiceConfig(env, cwd)
  const storageFile = normalizeSyncText(syncStorePath)
    ? resolve(cwd, syncStorePath)
    : config.storageFile

  if (!(await nightlyFileExists(storageFile))) {
    return []
  }

  const store = await readSyncStoreFile(storageFile, config.defaultScope)
  return collectNightlyIssueReports(store)
}
