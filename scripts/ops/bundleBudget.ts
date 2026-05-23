import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BundleBudgetOptions {
  distDir?: string | null
  maxEntryBytes?: number | null
  maxInitialJsBytes?: number | null
  forbiddenInitialPatterns?: string[] | null
}

export interface BundleBudgetAsset {
  href: string
  filePath: string
  bytes: number
}

export interface BundleBudgetResult {
  pass: boolean
  distDir: string
  entry: BundleBudgetAsset
  modulePreloads: BundleBudgetAsset[]
  initialJsBytes: number
  maxEntryBytes: number
  maxInitialJsBytes: number
  forbiddenInitialPatterns: string[]
  violations: string[]
}

const DEFAULT_DIST_DIR = 'dist'
const DEFAULT_MAX_ENTRY_BYTES = 450_000
const DEFAULT_MAX_INITIAL_JS_BYTES = 700_000
const DEFAULT_FORBIDDEN_INITIAL_PATTERNS = [
  'maplibre',
  'turf',
  'datasetLoadWorkflow',
  'parkingAnswer',
  'evaluateSegment',
  'clipCache',
]

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

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

const normalizeHref = (href: string) => href.replace(/^\//, '')

const readAsset = async (distDir: string, href: string): Promise<BundleBudgetAsset> => {
  const normalized = normalizeHref(href)
  const filePath = path.join(distDir, normalized)
  const stat = await fs.stat(filePath)
  return {
    href,
    filePath,
    bytes: stat.size,
  }
}

const matchFirst = (text: string, pattern: RegExp) => {
  const match = text.match(pattern)
  return match?.[1] ?? null
}

const matchAll = (text: string, pattern: RegExp) =>
  Array.from(text.matchAll(pattern), (match) => match[1]).filter(
    (value): value is string => Boolean(value),
  )

export const parseBundleBudgetArgs = (
  argv: string[],
): BundleBudgetOptions & { json?: boolean | null } => ({
  distDir: getArgValue(argv, '--dist', '--dist-dir', '--distDir'),
  maxEntryBytes:
    parsePositiveInteger(
      getArgValue(argv, '--max-entry-bytes', '--maxEntryBytes'),
      'max-entry-bytes',
    ) ?? null,
  maxInitialJsBytes:
    parsePositiveInteger(
      getArgValue(argv, '--max-initial-js-bytes', '--maxInitialJsBytes'),
      'max-initial-js-bytes',
    ) ?? null,
  forbiddenInitialPatterns: getArgValue(
    argv,
    '--forbid-initial',
    '--forbidden-initial',
  )
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  json: hasFlag(argv, '--json'),
})

export const runBundleBudget = async (
  options: BundleBudgetOptions = {},
): Promise<BundleBudgetResult> => {
  const distDir = options.distDir?.trim() || DEFAULT_DIST_DIR
  const maxEntryBytes = options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES
  const maxInitialJsBytes =
    options.maxInitialJsBytes ?? DEFAULT_MAX_INITIAL_JS_BYTES
  const forbiddenInitialPatterns =
    options.forbiddenInitialPatterns ?? DEFAULT_FORBIDDEN_INITIAL_PATTERNS
  const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8')
  const entryHref = matchFirst(
    indexHtml,
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*>/,
  )
  if (!entryHref) {
    throw new Error(`No module entry script found in ${path.join(distDir, 'index.html')}`)
  }

  const preloadHrefs = matchAll(
    indexHtml,
    /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["'][^>]*>/g,
  )
  const entry = await readAsset(distDir, entryHref)
  const modulePreloads = await Promise.all(
    preloadHrefs.map((href) => readAsset(distDir, href)),
  )
  const initialAssets = [entry, ...modulePreloads]
  const initialJsBytes = initialAssets.reduce((total, asset) => total + asset.bytes, 0)
  const violations: string[] = []

  if (entry.bytes > maxEntryBytes) {
    violations.push(`entry ${entry.href} is ${entry.bytes} bytes > ${maxEntryBytes}`)
  }
  if (initialJsBytes > maxInitialJsBytes) {
    violations.push(`initial JS is ${initialJsBytes} bytes > ${maxInitialJsBytes}`)
  }
  for (const pattern of forbiddenInitialPatterns) {
    const lowerPattern = pattern.toLowerCase()
    const matched = initialAssets.find((asset) =>
      asset.href.toLowerCase().includes(lowerPattern),
    )
    if (matched) {
      violations.push(`forbidden initial chunk ${pattern}: ${matched.href}`)
    }
  }

  return {
    pass: violations.length === 0,
    distDir,
    entry,
    modulePreloads,
    initialJsBytes,
    maxEntryBytes,
    maxInitialJsBytes,
    forbiddenInitialPatterns,
    violations,
  }
}

export const renderBundleBudget = (result: BundleBudgetResult) => {
  const lines = [
    `# Bundle Budget: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Dist: ${result.distDir}`,
    `- Entry: ${result.entry.href} (${result.entry.bytes} bytes / max ${result.maxEntryBytes})`,
    `- Initial JS: ${result.initialJsBytes} bytes / max ${result.maxInitialJsBytes}`,
    `- Module preloads: ${
      result.modulePreloads.length
        ? result.modulePreloads.map((asset) => `${asset.href} (${asset.bytes})`).join(', ')
        : 'none'
    }`,
    `- Forbidden initial patterns: ${result.forbiddenInitialPatterns.join(', ')}`,
    '',
    '## Violations',
    '',
    ...(result.violations.length
      ? result.violations.map((violation) => `- ${violation}`)
      : ['- none']),
  ]
  return lines.join('\n')
}

const run = async () => {
  const options = parseBundleBudgetArgs(process.argv)
  const result = await runBundleBudget(options)
  console.log(options.json ? JSON.stringify(result, null, 2) : renderBundleBudget(result))
  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
