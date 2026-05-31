import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'

export interface IngestAllArgs {
  globPattern: string | null
  allowWarn: boolean
  allowFail: boolean
  overrideReason: string | null
  dryRun: boolean
  noCleanup: boolean
}

export const parseIngestAllArgs = (argv: string[]): IngestAllArgs => {
  const args = [...argv]
  const globIndex = args.findIndex(
    (arg) => arg === '--configs' || arg === '--config-glob' || arg === '--glob',
  )
  const overrideIndex = args.findIndex((arg) => arg === '--override')

  return {
    globPattern: globIndex >= 0 ? args[globIndex + 1] : null,
    allowWarn: args.includes('--allowWarn'),
    allowFail: args.includes('--allowFail'),
    overrideReason: overrideIndex >= 0 ? args[overrideIndex + 1] : null,
    dryRun: args.includes('--dryRun'),
    noCleanup: args.includes('--noCleanup'),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasIngestInputs = (parsed: Record<string, unknown>) =>
  isRecord(parsed.inputs)

export const expandConfigPaths = async (paths: string[]) => {
  const expanded: string[] = []
  const seen = new Set<string>()
  const queued = paths.map((rawPath) => path.resolve(rawPath))

  for (const resolved of queued) {
    if (seen.has(resolved)) {
      continue
    }
    seen.add(resolved)

    let parsed: Record<string, unknown> | null = null
    try {
      const raw = await fs.readFile(resolved, 'utf-8')
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }

    if (!parsed || !('includeConfigs' in parsed)) {
      if (parsed && hasIngestInputs(parsed)) {
        expanded.push(resolved)
      }
      continue
    }

    if (hasIngestInputs(parsed)) {
      expanded.push(resolved)
    }

    const includeConfigs = parsed.includeConfigs
    if (!Array.isArray(includeConfigs)) {
      throw new Error(`includeConfigs must be an array in ${resolved}`)
    }
    includeConfigs.forEach((entry) => {
      if (typeof entry !== 'string' || entry.trim().length === 0) {
        throw new Error(`includeConfigs entries must be non-empty strings in ${resolved}`)
      }
      const includePath = path.isAbsolute(entry)
        ? entry
        : path.resolve(path.dirname(resolved), entry)
      if (!seen.has(includePath)) {
        queued.push(includePath)
      }
    })
  }

  return expanded
}

export const resolveIngestAllConfigPaths = async (globPattern: string) => {
  const configPaths = await fg(globPattern.replace(/\\/g, '/'), {
    absolute: true,
    onlyFiles: true,
  })
  if (configPaths.length === 0) {
    throw new Error(`No config files matched: ${globPattern}`)
  }
  const expanded = await expandConfigPaths(configPaths)
  if (expanded.length === 0) {
    throw new Error(`No ingest config files matched: ${globPattern}`)
  }
  return expanded
}
