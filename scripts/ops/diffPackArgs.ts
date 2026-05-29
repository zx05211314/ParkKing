import { resolveCompat } from './pathCompat'

const DEFAULT_REPORT_NAME = 'diff_report.json'

export interface DiffPackCliArgs {
  prev: string | null
  next: string | null
  out: string | null
  format: 'json' | 'md'
}

export const parseDiffPackArgs = (argv: string[]): DiffPackCliArgs => {
  const args = [...argv]
  const prevIndex = args.findIndex((arg) => arg === '--prev')
  const nextIndex = args.findIndex((arg) => arg === '--next')
  const outIndex = args.findIndex((arg) => arg === '--out')
  const formatIndex = args.findIndex((arg) => arg === '--format')

  return {
    prev: prevIndex >= 0 ? args[prevIndex + 1] : null,
    next: nextIndex >= 0 ? args[nextIndex + 1] : null,
    out: outIndex >= 0 ? args[outIndex + 1] : null,
    format: args[formatIndex + 1] === 'md' ? 'md' : 'json',
  }
}

export const resolveDiffPackReportPath = (nextDir: string, outPath: string | null) =>
  outPath ?? resolveCompat(nextDir, DEFAULT_REPORT_NAME)

export const buildDiffPackUsageError = () =>
  new Error('Usage: tsx diffPacks.ts --next <path> [--prev <path>] [--out <path>] [--format json|md]')
