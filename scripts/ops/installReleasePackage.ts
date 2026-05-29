import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import {
  renderValidateReleasePackageResult,
  validateReleasePackage,
  type ValidateReleasePackageResult,
} from './validateReleasePackage'

const DEFAULT_OUT_ROOT = 'public/data/generated'
const DEFAULT_TMP_DIR = '.tmp/release-install'

export interface InstallReleasePackageArgs {
  url?: string | null
  manifestUrl?: string | null
  zipPath?: string | null
  manifestPath?: string | null
  outRoot?: string | null
  tmpDir?: string | null
  downloadToken?: string | null
  downloadAuthHeader?: string | null
  requireManifest?: boolean
  allowExisting?: boolean
  clean?: boolean
  districtIds?: string[]
}

export interface InstalledReleaseSummary {
  outRoot: string
  registryDistrictIds: string[]
  fileCount: number
}

export interface InstallReleasePackageResult extends InstalledReleaseSummary {
  source: string
  manifestSource: string | null
  extractedFiles: number
  manifestValidation: ValidateReleasePackageResult | null
}

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

const parseDistrictIds = (value: string | null) =>
  value === null
    ? []
    : value
        .split(',')
        .map((districtId) => districtId.trim())
        .filter(Boolean)

export const parseInstallReleasePackageArgs = (
  argv: string[],
): InstallReleasePackageArgs => ({
  url:
    getArgValue(argv, '--url', '--package-url', '--packageUrl') ??
    process.env.PARKKING_RELEASE_PACKAGE_URL ??
    null,
  manifestUrl:
    getArgValue(argv, '--manifest-url', '--manifestUrl') ??
    process.env.PARKKING_RELEASE_MANIFEST_URL ??
    null,
  zipPath: getArgValue(argv, '--zip', '--zip-path', '--zipPath'),
  manifestPath: getArgValue(argv, '--manifest', '--manifest-path', '--manifestPath'),
  outRoot:
    getArgValue(argv, '--out-root', '--outRoot') ??
    process.env.PARKKING_RELEASE_PACKAGE_OUT_ROOT ??
    DEFAULT_OUT_ROOT,
  tmpDir:
    getArgValue(argv, '--tmp-dir', '--tmpDir') ??
    process.env.PARKKING_RELEASE_PACKAGE_TMP_DIR ??
    DEFAULT_TMP_DIR,
  downloadToken:
    getArgValue(argv, '--download-token', '--downloadToken') ??
    process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN ??
    null,
  downloadAuthHeader:
    getArgValue(argv, '--download-auth-header', '--downloadAuthHeader') ??
    process.env.PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER ??
    null,
  requireManifest:
    hasFlag(argv, '--require-manifest', '--requireManifest') ||
    process.env.PARKKING_RELEASE_REQUIRE_MANIFEST === 'true',
  allowExisting:
    hasFlag(argv, '--allow-existing', '--allowExisting') ||
    process.env.PARKKING_RELEASE_PACKAGE_ALLOW_EXISTING === 'true',
  clean:
    !hasFlag(argv, '--no-clean', '--noClean') &&
    process.env.PARKKING_RELEASE_PACKAGE_CLEAN !== 'false',
  districtIds: parseDistrictIds(getArgValue(argv, '--district', '--districts')),
})

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const buildDownloadHeaders = (params: {
  downloadToken?: string | null
  downloadAuthHeader?: string | null
}) => {
  const headers: Record<string, string> = {
    'user-agent': 'ParkKing release package installer',
  }
  if (params.downloadAuthHeader) {
    headers.authorization = params.downloadAuthHeader
  } else if (params.downloadToken) {
    headers.authorization = `Bearer ${params.downloadToken}`
  }
  return headers
}

const downloadFile = async (
  url: string,
  outputPath: string,
  auth: Pick<InstallReleasePackageArgs, 'downloadToken' | 'downloadAuthHeader'>,
) => {
  const response = await fetch(url, {
    headers: buildDownloadHeaders(auth),
  })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
  return outputPath
}

const resolvePackageFile = async (params: {
  pathValue?: string | null
  url?: string | null
  tmpDir: string
  filename: string
  downloadToken?: string | null
  downloadAuthHeader?: string | null
}) => {
  if (params.pathValue) {
    return path.resolve(params.pathValue)
  }
  if (!params.url) {
    return null
  }
  return await downloadFile(
    params.url,
    path.resolve(params.tmpDir, params.filename),
    {
      downloadToken: params.downloadToken,
      downloadAuthHeader: params.downloadAuthHeader,
    },
  )
}

export const normalizeZipEntryPath = (entryName: string) => {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, '/'))
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error(`Unsafe release package entry path: ${entryName}`)
  }
  return normalized
}

const assertSafeOutRoot = (outRoot: string) => {
  const resolved = path.resolve(outRoot)
  const parsed = path.parse(resolved)
  if (resolved === parsed.root || resolved === process.cwd()) {
    throw new Error(`Refusing to clean unsafe release output root: ${resolved}`)
  }
  const normalized = resolved.replace(/\\/g, '/')
  const isGeneratedDataRoot =
    normalized.endsWith('/public/data/generated') ||
    normalized.endsWith('/data/generated') ||
    normalized.includes('/.tmp/')
  if (!isGeneratedDataRoot) {
    throw new Error(
      `Refusing to clean non-generated release output root: ${resolved}`,
    )
  }
  return resolved
}

const cleanDirectoryContents = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true })
  const entries = await fs.readdir(dirPath)
  await Promise.all(
    entries.map((entry) =>
      entry === '.gitkeep'
        ? Promise.resolve()
        : fs.rm(path.join(dirPath, entry), { recursive: true, force: true }),
    ),
  )
}

export const extractReleasePackage = async (params: {
  zipPath: string
  outRoot: string
  clean?: boolean
}) => {
  const outRoot = assertSafeOutRoot(params.outRoot)
  if (params.clean !== false) {
    await cleanDirectoryContents(outRoot)
  } else {
    await fs.mkdir(outRoot, { recursive: true })
  }

  const zip = new AdmZip(params.zipPath)
  let extractedFiles = 0
  for (const entry of zip.getEntries()) {
    const normalizedEntryName = normalizeZipEntryPath(entry.entryName)
    const outputPath = path.resolve(outRoot, normalizedEntryName)
    const relative = path.relative(outRoot, outputPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Unsafe release package output path: ${entry.entryName}`)
    }
    if (entry.isDirectory) {
      await fs.mkdir(outputPath, { recursive: true })
      continue
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, entry.getData())
    extractedFiles += 1
  }

  return extractedFiles
}

export const validateInstalledRelease = async (
  outRoot: string,
): Promise<InstalledReleaseSummary> => {
  const resolvedOutRoot = path.resolve(outRoot)
  const registryPath = path.join(resolvedOutRoot, 'registry.json')
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8')) as {
    districts?: Array<{ districtId?: unknown }>
  }
  const registryDistrictIds = (registry.districts ?? [])
    .map((district) => district.districtId)
    .filter((districtId): districtId is string => typeof districtId === 'string')
    .sort()

  if (registryDistrictIds.length === 0) {
    throw new Error(`Installed release registry has no districts: ${registryPath}`)
  }

  await Promise.all(
    registryDistrictIds.map(async (districtId) => {
      const districtRoot = path.join(resolvedOutRoot, districtId)
      const requiredFiles = ['LATEST.json', 'dataset_meta.json']
      for (const requiredFile of requiredFiles) {
        const filePath = path.join(districtRoot, requiredFile)
        if (!(await fileExists(filePath))) {
          throw new Error(
            `Installed release is missing ${districtId}/${requiredFile}`,
          )
        }
      }
    }),
  )

  const countFiles = async (dirPath: string): Promise<number> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const counts = await Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(dirPath, entry.name)
        return entry.isDirectory() ? countFiles(entryPath) : Promise.resolve(1)
      }),
    )
    return counts.reduce((sum, count) => sum + count, 0)
  }

  return {
    outRoot: resolvedOutRoot,
    registryDistrictIds,
    fileCount: await countFiles(resolvedOutRoot),
  }
}

export const installReleasePackage = async (
  args: InstallReleasePackageArgs,
): Promise<InstallReleasePackageResult> => {
  const outRoot = path.resolve(args.outRoot ?? DEFAULT_OUT_ROOT)
  const tmpDir = path.resolve(args.tmpDir ?? DEFAULT_TMP_DIR)
  const zipPath = await resolvePackageFile({
    pathValue: args.zipPath,
    url: args.url,
    tmpDir,
    filename: 'park-king-data.zip',
    downloadToken: args.downloadToken,
    downloadAuthHeader: args.downloadAuthHeader,
  })
  const manifestPath = await resolvePackageFile({
    pathValue: args.manifestPath,
    url: args.manifestUrl,
    tmpDir,
    filename: 'release_manifest.json',
    downloadToken: args.downloadToken,
    downloadAuthHeader: args.downloadAuthHeader,
  })

  if (!zipPath) {
    if (args.allowExisting) {
      const existingSummary = await validateInstalledRelease(outRoot)
      return {
        ...existingSummary,
        source: 'existing',
        manifestSource: null,
        extractedFiles: 0,
        manifestValidation: null,
      }
    }
    throw new Error(
      'Missing release package. Set PARKKING_RELEASE_PACKAGE_URL or pass --zip.',
    )
  }

  if (args.requireManifest && !manifestPath) {
    throw new Error(
      'Missing release manifest. Set PARKKING_RELEASE_MANIFEST_URL or pass --manifest.',
    )
  }

  let manifestValidation: ValidateReleasePackageResult | null = null
  if (manifestPath) {
    manifestValidation = await validateReleasePackage({
      zipPath,
      manifestPath,
      districtIds: args.districtIds ?? [],
    })
    if (!manifestValidation.pass) {
      throw new Error(
        `Release package validation failed:\n${manifestValidation.errors.join('\n')}`,
      )
    }
  }

  const extractedFiles = await extractReleasePackage({
    zipPath,
    outRoot,
    clean: args.clean,
  })
  const installedSummary = await validateInstalledRelease(outRoot)

  return {
    ...installedSummary,
    source: zipPath,
    manifestSource: manifestPath,
    extractedFiles,
    manifestValidation,
  }
}

export const renderInstallReleasePackageResult = (
  result: InstallReleasePackageResult,
) =>
  [
    '# Install Release Package: PASS',
    '',
    `- Source: ${result.source}`,
    `- Manifest: ${result.manifestSource ?? 'not provided'}`,
    `- Out root: ${result.outRoot}`,
    `- Registry districts: ${result.registryDistrictIds.join(', ')}`,
    `- Extracted files: ${result.extractedFiles}`,
    `- Installed files: ${result.fileCount}`,
    '',
    '## Manifest Validation',
    '',
    result.manifestValidation
      ? renderValidateReleasePackageResult(result.manifestValidation)
      : '- not enforced',
  ].join('\n')

const run = async () => {
  const args = parseInstallReleasePackageArgs(process.argv)
  const result = await installReleasePackage(args)
  console.log(renderInstallReleasePackageResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
