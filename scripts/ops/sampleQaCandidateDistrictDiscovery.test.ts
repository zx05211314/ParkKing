import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { discoverDistrictIds } from './sampleQaCandidateDistrictDiscovery'
import { REQUIRED_DATASET_FILES } from './sampleQaCandidateTypes'

const createDatasetDir = async (baseDir: string, districtId: string) => {
  const dirPath = path.join(baseDir, districtId)
  await fs.mkdir(dirPath, { recursive: true })
  await Promise.all(
    REQUIRED_DATASET_FILES.map((fileName) =>
      fs.writeFile(path.join(dirPath, fileName), '{}', 'utf-8'),
    ),
  )
}

describe('sampleQaCandidateDistrictDiscovery', () => {
  it('merges registry and directory-backed district ids into a stable list', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-dataset-discovery-'))
    await createDatasetDir(base, 'xinyi')
    await createDatasetDir(base, 'daan')
    await fs.writeFile(
      path.join(base, 'registry.json'),
      JSON.stringify({
        districts: [{ districtId: 'daan' }, { districtId: 'songshan' }],
      }),
      'utf-8',
    )

    await expect(discoverDistrictIds([base])).resolves.toEqual([
      'daan',
      'songshan',
      'xinyi',
    ])
  })
})
