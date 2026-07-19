import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const DEFAULT_RENDER_YAML = 'render.yaml'

export interface RenderBlueprintEnvVar {
  key: string
  value?: string
  sync?: string
}

export interface RenderBlueprintService {
  type?: string
  name?: string
  runtime?: string
  buildCommand?: string
  startCommand?: string
  healthCheckPath?: string
  envVars: RenderBlueprintEnvVar[]
}

export interface RenderBlueprintContractResult {
  pass: boolean
  filePath: string
  service: RenderBlueprintService | null
  checkedEnvVars: string[]
  errors: string[]
}

const REQUIRED_SERVICE_FIELDS: Array<{
  key: keyof RenderBlueprintService
  expected: string
}> = [
  { key: 'type', expected: 'web' },
  { key: 'name', expected: 'parkking' },
  { key: 'runtime', expected: 'node' },
  {
    key: 'buildCommand',
    expected:
      'npm ci --include=dev && npm run ops:install-release-package -- --require-manifest && npm run build',
  },
  { key: 'startCommand', expected: 'npm start' },
  { key: 'healthCheckPath', expected: '/api/parking-answer/ready' },
]

const REQUIRED_ENV_VALUES: Record<string, string> = {
  NODE_VERSION: '24.16.0',
  NODE_ENV: 'production',
  PARKKING_APP_HOST: '0.0.0.0',
  PARKKING_APP_STATIC_DIR: 'dist',
  PARKKING_APP_SPA_FALLBACK: 'true',
  PARKKING_APP_ENABLE_GEOCODER: 'true',
  PARKKING_APP_ENABLE_ROUTING: 'true',
  PARKKING_APP_ENABLE_PARKING_ANSWER: 'true',
  PARKKING_APP_ENABLE_SYNC: 'true',
  PARKKING_RELEASE_REQUIRE_MANIFEST: 'true',
  PARKKING_RELEASE_PACKAGE_OUT_ROOT: 'public/data/generated',
  PARKKING_RELEASE_PACKAGE_TMP_DIR: '.tmp/release-install',
  PARKKING_RELEASE_PACKAGE_CLEAN: 'true',
  VITE_GEOCODER_URL: '/api/geocode',
  VITE_ROUTING_URL: '/api/route',
  VITE_PARKING_ANSWER_URL: '/api/parking-answer',
  VITE_SYNC_BASE_URL: '/api/sync',
  VITE_SYNC_MODE: 'issue-upload-only',
  PARKKING_GEOCODER_REQUEST_TIMEOUT_MS: '5000',
  PARKKING_GEOCODER_PATH: '/api/geocode',
  PARKKING_ROUTING_REQUEST_TIMEOUT_MS: '8000',
  PARKKING_ROUTING_PATH: '/api/route',
  PARKKING_PARKING_ANSWER_PATH: '/api/parking-answer',
  PARKKING_PARKING_ANSWER_DATASET_ROOT: 'public/data/generated',
  PARKKING_PARKING_ANSWER_DEFAULT_DISTRICT: 'xinyi',
  PARKKING_PARKING_ANSWER_ALLOW_DATASET_DIR: 'false',
  PARKKING_PARKING_ANSWER_INDEX_ROOT: '.tmp/parking-answer-index',
  PARKKING_PARKING_ANSWER_CACHE_MAX_DISTRICTS: '1',
  PARKKING_SYNC_PATH: '/api/sync',
  PARKKING_SYNC_MODE: 'issue-upload-only',
  PARKKING_SYNC_DURABILITY: 'ephemeral',
}

const REQUIRED_SYNC_FALSE = [
  'PARKKING_RELEASE_PACKAGE_URL',
  'PARKKING_RELEASE_MANIFEST_URL',
  'PARKKING_RELEASE_DOWNLOAD_TOKEN',
  'PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER',
]

const REQUIRED_NON_WILDCARD_ENV_VALUES = ['PARKKING_SYNC_CORS_ORIGINS']

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const stripYamlScalar = (value: string) => {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const parseFieldLine = (line: string) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/)
  if (!match) {
    return null
  }
  return {
    key: match[1],
    value: stripYamlScalar(match[2]),
  }
}

export const parseRenderBlueprint = (content: string): RenderBlueprintService | null => {
  const lines = content.split(/\r?\n/)
  const service: RenderBlueprintService = {
    envVars: [],
  }
  let inFirstService = false
  let inEnvVars = false
  let currentEnvVar: RenderBlueprintEnvVar | null = null

  for (const line of lines) {
    if (/^\s*-\s+type:\s*/.test(line)) {
      if (inFirstService) {
        break
      }
      inFirstService = true
      const type = line.replace(/^\s*-\s+type:\s*/, '')
      service.type = stripYamlScalar(type)
      continue
    }
    if (!inFirstService) {
      continue
    }
    if (/^\s{2}-\s+/.test(line)) {
      break
    }
    if (/^\s*envVars:\s*$/.test(line)) {
      inEnvVars = true
      continue
    }
    if (inEnvVars) {
      const keyMatch = line.match(/^\s*-\s+key:\s*(.+)$/)
      if (keyMatch) {
        currentEnvVar = {
          key: stripYamlScalar(keyMatch[1]),
        }
        service.envVars.push(currentEnvVar)
        continue
      }
      if (currentEnvVar) {
        const field = parseFieldLine(line)
        if (field?.key === 'value' || field?.key === 'sync') {
          currentEnvVar[field.key] = field.value
        }
      }
      continue
    }

    const field = parseFieldLine(line)
    if (!field) {
      continue
    }
    if (
      field.key === 'name' ||
      field.key === 'runtime' ||
      field.key === 'buildCommand' ||
      field.key === 'startCommand' ||
      field.key === 'healthCheckPath'
    ) {
      service[field.key] = field.value
    }
  }

  return inFirstService ? service : null
}

const buildEnvMap = (service: RenderBlueprintService) =>
  new Map(service.envVars.map((envVar) => [envVar.key, envVar]))

export const validateRenderBlueprintContract = (
  service: RenderBlueprintService | null,
  filePath = DEFAULT_RENDER_YAML,
): RenderBlueprintContractResult => {
  const errors: string[] = []

  if (!service) {
    return {
      pass: false,
      filePath,
      service,
      checkedEnvVars: [],
      errors: [`${filePath} does not define a web service`],
    }
  }

  for (const requirement of REQUIRED_SERVICE_FIELDS) {
    const actual = service[requirement.key]
    if (actual !== requirement.expected) {
      errors.push(
        `${requirement.key} must be "${requirement.expected}" but found "${actual ?? 'missing'}"`,
      )
    }
  }

  const envMap = buildEnvMap(service)
  for (const [key, expected] of Object.entries(REQUIRED_ENV_VALUES)) {
    const actual = envMap.get(key)?.value
    if (actual !== expected) {
      errors.push(
        `${key} must have value "${expected}" but found "${actual ?? 'missing'}"`,
      )
    }
  }

  for (const key of REQUIRED_SYNC_FALSE) {
    const actual = envMap.get(key)?.sync
    if (actual !== 'false') {
      errors.push(`${key} must be declared with sync: false`)
    }
  }

  for (const key of REQUIRED_NON_WILDCARD_ENV_VALUES) {
    const actual = envMap.get(key)?.value
    if (!actual) {
      errors.push(`${key} must be declared with an explicit production value`)
      continue
    }
    const values = actual
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (values.length === 0 || values.includes('*')) {
      errors.push(`${key} must not include wildcard "*" in production`)
    }
  }

  return {
    pass: errors.length === 0,
    filePath,
    service,
    checkedEnvVars: [
      ...Object.keys(REQUIRED_ENV_VALUES),
      ...REQUIRED_SYNC_FALSE,
      ...REQUIRED_NON_WILDCARD_ENV_VALUES,
    ].sort(),
    errors,
  }
}

export const checkRenderBlueprintContract = async (
  filePath = DEFAULT_RENDER_YAML,
) => {
  const content = await fs.readFile(filePath, 'utf-8')
  return validateRenderBlueprintContract(parseRenderBlueprint(content), filePath)
}

export const renderRenderBlueprintContractResult = (
  result: RenderBlueprintContractResult,
) => {
  const lines = [
    `# Render Blueprint Contract: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- File: ${result.filePath}`,
    `- Service: ${result.service?.name ?? 'missing'}`,
    `- Runtime: ${result.service?.runtime ?? 'missing'}`,
    `- Health check: ${result.service?.healthCheckPath ?? 'missing'}`,
    `- Checked env vars: ${result.checkedEnvVars.length}`,
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
  ]
  return `${lines.join('\n')}\n`
}

const run = async () => {
  const filePath = getArgValue(process.argv, '--file') ?? DEFAULT_RENDER_YAML
  const result = await checkRenderBlueprintContract(filePath)
  console.log(renderRenderBlueprintContractResult(result))
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
