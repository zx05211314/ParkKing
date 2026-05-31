import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  resolveDistrictMetaPath,
  resolvePackPath,
} from './reportGateAnomalyPackPaths'

describe('reportGateAnomalyPackPaths', () => {
  it('resolves direct and nested pack paths containing dataset_meta.json', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'report-gate-pack-paths-'))
    const direct = path.join(root, 'direct')
    const nestedRoot = path.join(root, 'nested')
    const nested = path.join(nestedRoot, 'xinyi')
    await fs.mkdir(direct, { recursive: true })
    await fs.mkdir(nested, { recursive: true })
    await fs.writeFile(path.join(direct, 'dataset_meta.json'), '{}', 'utf-8')
    await fs.writeFile(path.join(nested, 'dataset_meta.json'), '{}', 'utf-8')

    await expect(resolvePackPath('xinyi', direct)).resolves.toBe(path.resolve(direct))
    await expect(resolvePackPath('xinyi', nestedRoot)).resolves.toBe(path.resolve(nested))
    await expect(resolveDistrictMetaPath(nestedRoot, 'xinyi')).resolves.toBe(
      path.resolve(nested, 'dataset_meta.json'),
    )
  })
})
