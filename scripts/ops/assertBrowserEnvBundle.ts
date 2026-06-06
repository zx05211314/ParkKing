import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const UNRESOLVED_VITE_ENV = 'import.meta.env'

export interface BrowserEnvBundleCheckOptions {
  distDir?: string
}

export interface BrowserEnvBundleCheckResult {
  entryFiles: string[]
  bundleFiles: string[]
}

export const parseModuleEntrySources = (html: string) =>
  Array.from(
    html.matchAll(
      /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    ),
    (match) => match[1],
  ).filter((source): source is string => Boolean(source))

const resolveLocalEntryPath = (distDir: string, source: string) => {
  if (/^https?:\/\//i.test(source)) {
    return null
  }

  const pathname = source.split(/[?#]/, 1)[0]?.replace(/^\/+/, '')
  return pathname ? path.resolve(distDir, pathname) : null
}

export const assertBrowserEnvBundle = async ({
  distDir = 'dist',
}: BrowserEnvBundleCheckOptions = {}): Promise<BrowserEnvBundleCheckResult> => {
  const absoluteDistDir = path.resolve(distDir)
  const html = await fs.readFile(path.join(absoluteDistDir, 'index.html'), 'utf-8')
  const entryFiles = parseModuleEntrySources(html)
    .map((source) => resolveLocalEntryPath(absoluteDistDir, source))
    .filter((filePath): filePath is string => Boolean(filePath))

  if (entryFiles.length === 0) {
    throw new Error(`No local module entry scripts found in ${absoluteDistDir}.`)
  }

  const assetsDir = path.join(absoluteDistDir, 'assets')
  const assetEntries = await fs.readdir(assetsDir, { withFileTypes: true })
  const bundleFiles = assetEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(assetsDir, entry.name))

  const unresolvedEntries: string[] = []
  for (const bundleFile of bundleFiles) {
    const content = await fs.readFile(bundleFile, 'utf-8')
    if (content.includes(UNRESOLVED_VITE_ENV)) {
      unresolvedEntries.push(
        path.relative(absoluteDistDir, bundleFile).replace(/\\/g, '/'),
      )
    }
  }

  if (unresolvedEntries.length > 0) {
    throw new Error(
      [
        'Unresolved import.meta.env access remains in production browser bundles.',
        ...unresolvedEntries.map((entry) => `- ${entry}`),
        'Read VITE_* values through explicit import.meta.env.KEY accesses so Vite can replace them.',
      ].join('\n'),
    )
  }

  return {
    entryFiles,
    bundleFiles,
  }
}

const run = async () => {
  const result = await assertBrowserEnvBundle()
  console.log(
    `Browser env bundle contract: PASS (${result.bundleFiles.length} JS bundle(s))`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
