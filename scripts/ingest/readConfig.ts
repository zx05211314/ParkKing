import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  collectSourceFiles,
  buildConfigHashes,
} from './readConfigSourceFiles'
import {
  parseConfigArg,
  resolveBoundaryConfig,
  resolveConfigInputs,
  resolveDerivedConfigSections,
  resolveDistrictIdentity,
  resolveOpsConfig,
  resolveOutputConfig,
  resolveValidationConfig,
} from './readConfigResolution'
import { resolveOverrideReportsPath } from './overrideReportsPath'
import type { IngestConfig, ResolvedConfig } from './readConfigTypes'

export type { IngestConfig, ResolvedConfig, SourceFileMeta } from './readConfigTypes'

export const readConfig = async (argv: string[] = process.argv): Promise<ResolvedConfig> => {
  const configArg = parseConfigArg(argv)
  if (!configArg) {
    throw new Error(
      'Missing --config. Example: npm run ingest -- --config ingest.config.json',
    )
  }

  const configPath = path.resolve(configArg)
  const raw = await fs.readFile(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as IngestConfig
  const configDir = path.dirname(configPath)

  const inputs = resolveConfigInputs(parsed, configDir)
  const { districtId, districtName } = resolveDistrictIdentity(parsed)
  const outputs = resolveOutputConfig(parsed, configDir, districtId)
  const sourceFiles = await collectSourceFiles(inputs, [
    resolveOverrideReportsPath(districtId),
  ])
  const { configHash, datasetHash } = buildConfigHashes(raw, sourceFiles)

  return {
    districtId,
    districtName,
    boundary: resolveBoundaryConfig(parsed),
    configPath,
    configHash,
    datasetHash,
    inputs,
    outputs,
    ...resolveDerivedConfigSections(parsed),
    ops: resolveOpsConfig(parsed),
    validation: resolveValidationConfig(parsed),
    sourceFiles,
  }
}
