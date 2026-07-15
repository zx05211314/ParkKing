import * as fs from 'node:fs/promises'

import {
  resolveDistrictConfigPath,
  resolveDistrictId,
} from './fetchSourcesManifestDistricts'
import { hashBufferSha256 } from './fetchSourcesProvenance'
import type { DistrictSourceManifest } from './fetchSourcesTypes'

const buildSourceManifestHash = (manifest: DistrictSourceManifest) =>
  hashBufferSha256(
    Buffer.from(
      JSON.stringify({
        districtId: manifest.districtId,
        sourceOnly: true,
        sources: manifest.sources ?? [],
      }),
    ),
  )

export const resolveDistrictSourceContext = async (params: {
  manifest: DistrictSourceManifest
  manifestDir: string
  resolvedDestinations: string[]
}) => {
  const districtId = resolveDistrictId(params.manifest, params.resolvedDestinations)
  const configPath = await resolveDistrictConfigPath(
    params.manifest,
    params.manifestDir,
    districtId,
  )

  if (!districtId) {
    throw new Error(
      'Unable to resolve districtId/configPath. Provide districtId or configPath in manifest.',
    )
  }

  if (!configPath) {
    if (!params.manifest.sourceOnly) {
      throw new Error(
        'Unable to resolve districtId/configPath. Provide districtId or configPath in manifest.',
      )
    }
    return {
      districtId,
      configDistrictId: districtId,
      configPath: null,
      configHash: buildSourceManifestHash(params.manifest),
      sourceOnly: true,
    }
  }

  const configRaw = await fs.readFile(configPath, 'utf-8')
  const config = JSON.parse(configRaw) as { districtId?: string }

  return {
    districtId,
    configDistrictId: config.districtId ?? districtId,
    configPath,
    configHash: hashBufferSha256(Buffer.from(configRaw)),
    sourceOnly: false,
  }
}
