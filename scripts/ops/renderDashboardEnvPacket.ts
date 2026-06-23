import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getArgValue, hasFlag } from './githubWorkflowDispatch'
import { REQUIRED_RENDER_RUNTIME_ENV } from './renderDeploymentEnv'

const DEFAULT_HANDOFF_CANDIDATES = [
  '.tmp/production-rollout-handoff.json',
  '.tmp/render-deployment-handoff.json',
]
const DEFAULT_OUT_PATH = '.tmp/render-dashboard-env-packet.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/render-dashboard-env-packet.json'
const DEFAULT_REF = 'main'

export interface RenderDashboardEnvPacketOptions {
  handoffJsonPath: string | null
  packageUrl: string | null
  manifestUrl: string | null
  appUrl: string | null
  ref: string
  runtimeOnly: boolean
  outPath: string | null
  jsonOutPath: string | null
}

export interface RenderDashboardEnvRow {
  category: 'release' | 'runtime'
  key: string
  value: string
}

export interface RenderDashboardEnvPacketResult {
  pass: boolean
  envSource: 'handoff' | 'urls' | 'runtime'
  handoffJsonPath: string | null
  releasePackageUrl: string | null
  releaseManifestUrl: string | null
  appUrl: string | null
  requiredEnv: Record<string, string>
  rows: RenderDashboardEnvRow[]
  commands: {
    renderRuntimeEnvSyncDryRun: string
    renderRuntimeEnvSyncApply: string
    productionRolloutStatusCheckLive: string
    renderDeploymentVerify: string
  }
  warnings: string[]
  errors: string[]
}

interface HandoffReleaseUrls {
  packageUrl: string | null
  manifestUrl: string | null
}

const quoteCommandValue = (value: string) =>
  /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value

const quotePowerShellValue = (value: string) => `"${value.replaceAll('"', '`"')}"`

const normalizeOptionalString = (value: string | null | undefined) =>
  value?.trim() || null

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getString = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'string' ? record[key] : null

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const validateHttpUrl = (value: string, label: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must be http(s): ${value}`)
  }
}

const isPlaceholderReleaseUrl = (value: string | null) =>
  value !== null && /(^|\/)owner\/repo(\/|$)/.test(value)

const placeholderReleaseUrlErrors = (urls: HandoffReleaseUrls) => [
  ...(isPlaceholderReleaseUrl(urls.packageUrl)
    ? ['PARKKING_RELEASE_PACKAGE_URL still contains placeholder owner/repo']
    : []),
  ...(isPlaceholderReleaseUrl(urls.manifestUrl)
    ? ['PARKKING_RELEASE_MANIFEST_URL still contains placeholder owner/repo']
    : []),
]

const originFromAppUrl = (appUrl: string | null) => {
  if (!appUrl) {
    return null
  }
  const url = new URL(appUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`--app-url must be http(s): ${appUrl}`)
  }
  return url.origin
}

export const parseRenderDashboardEnvPacketArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): RenderDashboardEnvPacketOptions => ({
  handoffJsonPath: normalizeOptionalString(
    getArgValue(argv, '--handoff-json', '--handoffJson'),
  ),
  packageUrl: normalizeOptionalString(
    getArgValue(argv, '--package-url', '--packageUrl') ??
      env.PARKKING_RELEASE_PACKAGE_URL,
  ),
  manifestUrl: normalizeOptionalString(
    getArgValue(argv, '--manifest-url', '--manifestUrl') ??
      env.PARKKING_RELEASE_MANIFEST_URL,
  ),
  appUrl: normalizeOptionalString(
    getArgValue(argv, '--app-url', '--appUrl') ?? env.PARKKING_RENDER_APP_URL,
  ),
  ref: normalizeOptionalString(getArgValue(argv, '--ref')) ?? DEFAULT_REF,
  runtimeOnly: hasFlag(argv, '--runtime-only') || hasFlag(argv, '--runtimeOnly'),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
})

const resolveDefaultHandoffPath = async () => {
  let fallback: string | null = null
  for (const candidate of DEFAULT_HANDOFF_CANDIDATES) {
    if (!(await fileExists(candidate))) {
      continue
    }
    fallback = fallback ?? candidate
    try {
      const urls = await readHandoffReleaseUrls(candidate)
      if (placeholderReleaseUrlErrors(urls).length === 0) {
        return candidate
      }
    } catch {
      return candidate
    }
  }
  return fallback
}

const readHandoffReleaseUrls = async (
  handoffJsonPath: string,
): Promise<HandoffReleaseUrls> => {
  const parsed = toRecord(
    JSON.parse(await fs.readFile(handoffJsonPath, 'utf-8')) as unknown,
  )
  const renderEnv = toRecord(parsed?.renderEnv)
  return {
    packageUrl:
      getString(parsed, 'packageUrl') ??
      getString(renderEnv, 'PARKKING_RELEASE_PACKAGE_URL'),
    manifestUrl:
      getString(parsed, 'manifestUrl') ??
      getString(renderEnv, 'PARKKING_RELEASE_MANIFEST_URL'),
  }
}

const resolveReleaseUrls = async (
  options: RenderDashboardEnvPacketOptions,
) => {
  const errors: string[] = []
  if (options.runtimeOnly) {
    return {
      handoffJsonPath: options.handoffJsonPath,
      packageUrl: null,
      manifestUrl: null,
      envSource: 'runtime' as const,
      errors,
    }
  }

  let packageUrl = options.packageUrl
  let manifestUrl = options.manifestUrl
  const hasReleaseUrlInputs = Boolean(packageUrl || manifestUrl)
  const handoffJsonPath =
    options.handoffJsonPath ??
    (hasReleaseUrlInputs ? null : await resolveDefaultHandoffPath())
  let usedHandoff = false

  if (handoffJsonPath) {
    try {
      const handoff = await readHandoffReleaseUrls(handoffJsonPath)
      errors.push(...placeholderReleaseUrlErrors(handoff))
      usedHandoff = Boolean(
        (!packageUrl && handoff.packageUrl) || (!manifestUrl && handoff.manifestUrl),
      )
      packageUrl = packageUrl ?? handoff.packageUrl
      manifestUrl = manifestUrl ?? handoff.manifestUrl
    } catch (error) {
      errors.push(
        `Could not read release URLs from ${handoffJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  if ((packageUrl && !manifestUrl) || (!packageUrl && manifestUrl)) {
    errors.push(
      'Both PARKKING_RELEASE_PACKAGE_URL and PARKKING_RELEASE_MANIFEST_URL are required for a release env packet.',
    )
  }
  if (!options.runtimeOnly && !packageUrl && !manifestUrl) {
    errors.push(
      'Missing release URLs. Pass --handoff-json, --package-url plus --manifest-url, or rerun with --runtime-only.',
    )
  }
  if (packageUrl) {
    validateHttpUrl(packageUrl, '--package-url')
  }
  if (manifestUrl) {
    validateHttpUrl(manifestUrl, '--manifest-url')
  }
  errors.push(
    ...placeholderReleaseUrlErrors({
      packageUrl: packageUrl ?? null,
      manifestUrl: manifestUrl ?? null,
    }),
  )

  const envSource: RenderDashboardEnvPacketResult['envSource'] =
    hasReleaseUrlInputs ? 'urls' : usedHandoff ? 'handoff' : 'runtime'

  return {
    handoffJsonPath,
    packageUrl: packageUrl && manifestUrl ? packageUrl : null,
    manifestUrl: packageUrl && manifestUrl ? manifestUrl : null,
    envSource,
    errors,
  }
}

const buildRequiredEnv = (params: {
  packageUrl: string | null
  manifestUrl: string | null
  appUrl: string | null
}) => {
  const runtimeEnv = {
    ...REQUIRED_RENDER_RUNTIME_ENV,
    ...(params.appUrl
      ? { PARKKING_SYNC_CORS_ORIGINS: originFromAppUrl(params.appUrl) ?? '' }
      : {}),
  }
  return params.packageUrl && params.manifestUrl
    ? {
        PARKKING_RELEASE_PACKAGE_URL: params.packageUrl,
        PARKKING_RELEASE_MANIFEST_URL: params.manifestUrl,
        ...runtimeEnv,
      }
    : runtimeEnv
}

const buildRows = (requiredEnv: Record<string, string>): RenderDashboardEnvRow[] =>
  Object.entries(requiredEnv).map(([key, value]) => ({
    category: key.startsWith('PARKKING_RELEASE_') ? 'release' : 'runtime',
    key,
    value,
  }))

const buildCommands = (params: {
  handoffJsonPath: string | null
  packageUrl: string | null
  manifestUrl: string | null
  appUrl: string | null
  ref: string
}) => {
  const handoffArg = params.handoffJsonPath
    ? ` --handoff-json ${quoteCommandValue(params.handoffJsonPath)}`
    : ''
  const packageManifestArgs =
    params.packageUrl && params.manifestUrl
      ? ` --package-url ${quoteCommandValue(params.packageUrl)} --manifest-url ${quoteCommandValue(params.manifestUrl)}`
      : ''
  const releaseArgs = handoffArg || packageManifestArgs
  const appUrl = params.appUrl ?? '<Render service URL>'
  const rolloutBase = `npm run ops:production-rollout-status -- --ref ${quoteCommandValue(
    params.ref,
  )} --app-url ${quoteCommandValue(appUrl)}${releaseArgs}`
  const verifyBase = `npm run ops:render-deployment-verify -- --app-url ${quoteCommandValue(
    appUrl,
  )}${releaseArgs}`
  const syncBase = `npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>"${releaseArgs}`
  return {
    renderRuntimeEnvSyncDryRun: syncBase,
    renderRuntimeEnvSyncApply: `${syncBase} --execute --deploy`,
    productionRolloutStatusCheckLive: `${rolloutBase} --check-live`,
    renderDeploymentVerify: verifyBase,
  }
}

export const buildRenderDashboardEnvPacket = async (
  options: RenderDashboardEnvPacketOptions,
): Promise<RenderDashboardEnvPacketResult> => {
  const resolved = await resolveReleaseUrls(options)
  const appUrl = options.appUrl
  if (appUrl) {
    validateHttpUrl(appUrl, '--app-url')
  }
  const requiredEnv = buildRequiredEnv({
    packageUrl: resolved.packageUrl,
    manifestUrl: resolved.manifestUrl,
    appUrl,
  })
  const warnings = [
    ...(options.runtimeOnly
      ? ['Runtime-only mode omits release package URLs; it cannot fix dataset hash drift.']
      : []),
    ...(appUrl
      ? []
      : [
          'No --app-url or PARKKING_RENDER_APP_URL was provided; CORS uses the default production origin and verification commands include a placeholder.',
        ]),
  ]
  const errors = [...resolved.errors]

  return {
    pass: errors.length === 0,
    envSource: resolved.envSource,
    handoffJsonPath: resolved.handoffJsonPath,
    releasePackageUrl: resolved.packageUrl,
    releaseManifestUrl: resolved.manifestUrl,
    appUrl,
    requiredEnv,
    rows: buildRows(requiredEnv),
    commands: buildCommands({
      handoffJsonPath: resolved.handoffJsonPath,
      packageUrl: resolved.packageUrl,
      manifestUrl: resolved.manifestUrl,
      appUrl,
      ref: options.ref,
    }),
    warnings,
    errors,
  }
}

export const renderRenderDashboardEnvPacket = (
  result: RenderDashboardEnvPacketResult,
) =>
  [
    `# Render Dashboard Env Packet: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Source',
    '',
    `- Env source: ${result.envSource}`,
    `- Handoff JSON: ${result.handoffJsonPath ?? '-'}`,
    `- App URL: ${result.appUrl ?? '-'}`,
    `- Release package URL: ${result.releasePackageUrl ?? '-'}`,
    `- Release manifest URL: ${result.releaseManifestUrl ?? '-'}`,
    '',
    '## Render Dashboard Values',
    '',
    '| Category | Key | Value |',
    '| --- | --- | --- |',
    ...result.rows.map(
      (row) => `| ${row.category} | ${row.key} | ${row.value} |`,
    ),
    '',
    '## PowerShell Export Preview',
    '',
    '```powershell',
    ...Object.entries(result.requiredEnv).map(
      ([key, value]) => `$env:${key}=${quotePowerShellValue(value)}`,
    ),
    '```',
    '',
    '## Dashboard Checklist',
    '',
    '- Open Render Dashboard -> parkking service -> Environment.',
    '- Add or update every key in Render Dashboard Values with the exact value shown.',
    '- Save changes and trigger Manual Deploy -> Deploy latest commit.',
    '- Wait for the deploy to complete before running live verification.',
    '',
    '## Verification Commands',
    '',
    `- Preview API sync equivalent: ${result.commands.renderRuntimeEnvSyncDryRun}`,
    `- Apply API sync equivalent: ${result.commands.renderRuntimeEnvSyncApply}`,
    `- Production rollout live check: ${result.commands.productionRolloutStatusCheckLive}`,
    `- Render deployment verify: ${result.commands.renderDeploymentVerify}`,
    '',
    '## Warnings',
    '',
    ...(result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ['- none']),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
    '',
  ].join('\n')

export const writeRenderDashboardEnvPacketOutputs = async (
  result: RenderDashboardEnvPacketResult,
  options: Pick<RenderDashboardEnvPacketOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, renderRenderDashboardEnvPacket(result), 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/renderDashboardEnvPacket.ts [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Release handoff JSON; defaults to .tmp/production-rollout-handoff.json when present, then .tmp/render-deployment-handoff.json',
        '  --package-url <url>         PARKKING_RELEASE_PACKAGE_URL when no handoff JSON is available',
        '  --manifest-url <url>        PARKKING_RELEASE_MANIFEST_URL when no handoff JSON is available',
        '  --app-url <url>             Render app URL; sets PARKKING_SYNC_CORS_ORIGINS to the URL origin',
        '  --ref <branch>              Verification ref; defaults to main',
        '  --runtime-only              Emit runtime hardening env only; does not fix dataset release drift',
        '  --out <path>                Defaults to .tmp/render-dashboard-env-packet.md',
        '  --json-out <path>           Defaults to .tmp/render-dashboard-env-packet.json',
      ].join('\n'),
    )
    return
  }

  const options = parseRenderDashboardEnvPacketArgs(argv)
  const result = await buildRenderDashboardEnvPacket(options)
  await writeRenderDashboardEnvPacketOutputs(result, options)
  console.log(renderRenderDashboardEnvPacket(result))
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
