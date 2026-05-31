import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanupBackups, type CleanupOptions } from './cleanupBackups'
import { resolveCleanupBackupsOptions } from './cleanupBackupsOptions'

export interface WorkflowCleanupOptions {
  baseDir?: string | null
  maxBackups?: number | null
  maxAgeDays?: number | null
  summaryPath?: string | null
  logPath?: string | null
  now?: Date
}

export interface WorkflowCleanupResult {
  generatedAt: string
  command: string
  options: CleanupOptions
  backupDirsBefore: number
  backupDirsAfter: number
  stagingDirsBefore: number
  stagingDirsAfter: number
  removed: string[]
  summaryPath: string
  logPath: string
}

export interface WorkflowCleanupRunners {
  cleanup: (options: CleanupOptions) => Promise<string[]>
}

const DEFAULT_SUMMARY_PATH = '.tmp/cleanup-summary.txt'
const DEFAULT_LOG_PATH = '.tmp/cleanup.log'

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parseNumberArg = (value: string | null) =>
  value === null ? null : Number(value)

export const parseWorkflowCleanupArgs = (argv: string[]): WorkflowCleanupOptions => ({
  baseDir: getArgValue(argv, '--baseDir', '--base-dir'),
  maxBackups: parseNumberArg(getArgValue(argv, '--maxBackups', '--max-backups')),
  maxAgeDays: parseNumberArg(getArgValue(argv, '--maxAgeDays', '--max-age-days')),
  summaryPath: getArgValue(argv, '--summary', '--summary-path'),
  logPath: getArgValue(argv, '--log', '--log-path'),
})

const countChildDirectories = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).length
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'ENOENT') {
      return 0
    }
    throw error
  }
}

const formatCleanupSummary = (result: Omit<WorkflowCleanupResult, 'summaryPath' | 'logPath'>) =>
  [
    `generatedAt=${result.generatedAt}`,
    `command=${result.command}`,
    `backupDirsBefore=${result.backupDirsBefore}`,
    `backupDirsAfter=${result.backupDirsAfter}`,
    `stagingDirsBefore=${result.stagingDirsBefore}`,
    `stagingDirsAfter=${result.stagingDirsAfter}`,
    `removedCount=${result.removed.length}`,
  ].join('\n')

const formatCleanupLog = (removed: string[]) =>
  [
    `Removed ${removed.length} backup/staging entries.`,
    ...removed.map((entry) => `- ${entry}`),
  ].join('\n')

export const runWorkflowCleanup = async (
  options: WorkflowCleanupOptions = {},
  runners: WorkflowCleanupRunners = { cleanup: cleanupBackups },
): Promise<WorkflowCleanupResult> => {
  const cleanupOptions = resolveCleanupBackupsOptions({
    baseDir: options.baseDir ?? null,
    maxBackups: options.maxBackups ?? null,
    maxAgeDays: options.maxAgeDays ?? null,
  })
  const backupRoot = path.resolve(cleanupOptions.baseDir, '.backup')
  const stagingRoot = path.resolve(cleanupOptions.baseDir, '.staging')
  const backupDirsBefore = await countChildDirectories(backupRoot)
  const stagingDirsBefore = await countChildDirectories(stagingRoot)
  const removed = await runners.cleanup(cleanupOptions)
  const backupDirsAfter = await countChildDirectories(backupRoot)
  const stagingDirsAfter = await countChildDirectories(stagingRoot)
  const generatedAt = (options.now ?? new Date()).toISOString()
  const summaryPath = path.resolve(options.summaryPath ?? DEFAULT_SUMMARY_PATH)
  const logPath = path.resolve(options.logPath ?? DEFAULT_LOG_PATH)
  const command = `npm run ops:cleanup -- --maxBackups ${cleanupOptions.maxBackupsPerDistrict} --maxAgeDays ${cleanupOptions.maxBackupAgeDays}`

  const result: WorkflowCleanupResult = {
    generatedAt,
    command,
    options: cleanupOptions,
    backupDirsBefore,
    backupDirsAfter,
    stagingDirsBefore,
    stagingDirsAfter,
    removed,
    summaryPath,
    logPath,
  }

  await fs.mkdir(path.dirname(summaryPath), { recursive: true })
  await fs.mkdir(path.dirname(logPath), { recursive: true })
  await fs.writeFile(summaryPath, `${formatCleanupSummary(result)}\n`, 'utf-8')
  await fs.writeFile(logPath, `${formatCleanupLog(removed)}\n`, 'utf-8')
  return result
}

const run = async () => {
  const result = await runWorkflowCleanup(parseWorkflowCleanupArgs(process.argv))
  console.log(`Workflow cleanup wrote ${result.summaryPath}`)
  console.log(`Workflow cleanup log wrote ${result.logPath}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
