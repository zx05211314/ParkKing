import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  hasRequiredDatasetFiles,
  resolveDistrictDatasetDir,
} from './sampleQaCandidateDatasetFiles'
import { REQUIRED_DATASET_FILES } from './sampleQaCandidateTypes'

const createDatasetDir = async (baseDir: string, districtId: string) => {
  const dirPath = path.join(baseDir, districtId)
  await fs.mkdir(dirPath, { recursive: true })
  await Promise.all(
    REQUIRED_DATASET_FILES.map((fileName) =>
      fs.writeFile(path.join(dirPath, fileName), '{}', 'utf-8'),
    ),
  )
  return dirPath
}

describe('sampleQaCandidateDatasetFiles', () => {
  it('detects complete dataset directories and resolves the first valid root', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-dataset-files-'))
    const firstRoot = path.join(base, 'root-a')
    const secondRoot = path.join(base, 'root-b')
    await fs.mkdir(firstRoot, { recursive: true })
    await fs.mkdir(secondRoot, { recursive: true })
    const expected = await createDatasetDir(secondRoot, 'xinyi')

    expect(await hasRequiredDatasetFiles(expected)).toBe(true)
    await expect(
      resolveDistrictDatasetDir('xinyi', [firstRoot, secondRoot]),
    ).resolves.toBe(expected)
  })
})
