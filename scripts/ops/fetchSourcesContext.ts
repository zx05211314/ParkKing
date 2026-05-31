import * as fs from 'node:fs/promises'

import {
  resolveDistrictConfigPath,
  resolveDistrictId,
} from './fetchSourcesManifestDistricts'
import { hashBufferSha256 } from './fetchSourcesProvenance'
import type { DistrictSourceManifest } from './fetchSourcesTypes'

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

  if (!districtId || !configPath) {
    throw new Error(
      'Unable to resolve districtId/configPath. Provide districtId or configPath in manifest.',
    )
  }

  const configRaw = await fs.readFile(configPath, 'utf-8')
  const config = JSON.parse(configRaw) as { districtId?: string }

  return {
    districtId,
    configDistrictId: config.districtId ?? districtId,
    configPath,
    configHash: hashBufferSha256(Buffer.from(configRaw)),
  }
}
