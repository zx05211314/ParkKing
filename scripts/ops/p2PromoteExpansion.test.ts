import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseP2PromoteExpansionArgs,
  renderP2PromoteExpansion,
  runP2PromoteExpansion,
} from './p2PromoteExpansion'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'p2-promote-expansion-'))

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

const readJson = async (targetPath: string) =>
  JSON.parse(await fs.readFile(targetPath, 'utf-8')) as Record<string, unknown>

const writeExpansionFiles = async (root: string, districtId = 'songshan') => {
  const sourceRoot = path.join(root, 'configs', 'expansion')
  await writeJson(path.join(sourceRoot, `${districtId}.json`), {
    districtId,
    districtName: 'Songshan',
    inputs: {
      districtBounds: '../../data/sources/shared/district_bounds.geojson',
    },
  })
  await writeJson(path.join(sourceRoot, `${districtId}.answer-cases.json`), {
    schemaVersion: 1,
    districtId,
    datasetHash: 'reviewed-hash',
    cases: [
      {
        id: `${districtId}-case-1`,
        lng: 121.56,
        lat: 25.05,
        expectedKind: 'PARK',
      },
    ],
  })
}

describe('p2PromoteExpansion', () => {
  it('parses promotion args', () => {
    expect(
      parseP2PromoteExpansionArgs([
        'node',
        'p2PromoteExpansion',
        '--district',
        'songshan',
        '--source-root',
        'configs/expansion',
        '--target-root',
        'configs/prod',
        '--execute',
        '--overwrite',
        '--out',
        '.tmp/promote.md',
        '--json-out',
        '.tmp/promote.json',
        '--json',
      ]),
    ).toMatchObject({
      districtId: 'songshan',
      sourceRoot: 'configs/expansion',
      targetRoot: 'configs/prod',
      execute: true,
      overwrite: true,
      outPath: '.tmp/promote.md',
      jsonOutPath: '.tmp/promote.json',
      json: true,
    })
  })

  it('blocks promotion until reviewed answer cases exist', async () => {
    const root = await makeTempRoot()
    const sourceRoot = path.join(root, 'configs', 'expansion')
    await writeJson(path.join(sourceRoot, 'songshan.json'), {
      districtId: 'songshan',
      inputs: {},
    })

    const result = await runP2PromoteExpansion({
      districtId: 'songshan',
      sourceRoot,
      targetRoot: path.join(root, 'configs', 'prod'),
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      `Missing reviewed expansion answer cases: ${path.join(sourceRoot, 'songshan.answer-cases.json')}. Run p0-finalize-review after human review first.`,
    )
    expect(renderP2PromoteExpansion(result)).toContain(
      '# P2 Promote Expansion: BLOCKED',
    )
  })

  it('dry-runs a valid promotion without copying files', async () => {
    const root = await makeTempRoot()
    await writeExpansionFiles(root)
    const sourceRoot = path.join(root, 'configs', 'expansion')
    const targetRoot = path.join(root, 'configs', 'prod')

    const result = await runP2PromoteExpansion({
      districtId: 'songshan',
      sourceRoot,
      targetRoot,
    })

    expect(result.pass).toBe(true)
    expect(result.mode).toBe('dry-run')
    expect(result.files.every((file) => !file.copied)).toBe(true)
    await expect(
      fs.access(path.join(targetRoot, 'songshan.json')),
    ).rejects.toThrow()
    expect(result.followUpCommands).toContain(
      'npm run ops:check-inputs -- --config configs/prod/songshan.json',
    )
    expect(result.warnings).toContain(
      'Dry run only; pass --execute to copy reviewed expansion files to prod.',
    )
  })

  it('copies reviewed expansion files when executed', async () => {
    const root = await makeTempRoot()
    await writeExpansionFiles(root)
    const sourceRoot = path.join(root, 'configs', 'expansion')
    const targetRoot = path.join(root, 'configs', 'prod')

    const result = await runP2PromoteExpansion({
      districtId: 'songshan',
      sourceRoot,
      targetRoot,
      execute: true,
    })

    expect(result.pass).toBe(true)
    expect(result.mode).toBe('execute')
    expect(result.files.every((file) => file.copied)).toBe(true)
    await expect(readJson(path.join(targetRoot, 'songshan.json'))).resolves.toMatchObject({
      districtId: 'songshan',
    })
    await expect(
      readJson(path.join(targetRoot, 'songshan.answer-cases.json')),
    ).resolves.toMatchObject({
      districtId: 'songshan',
      datasetHash: 'reviewed-hash',
    })
  })

  it('blocks accidental overwrite unless explicitly requested', async () => {
    const root = await makeTempRoot()
    await writeExpansionFiles(root)
    const sourceRoot = path.join(root, 'configs', 'expansion')
    const targetRoot = path.join(root, 'configs', 'prod')
    await writeJson(path.join(targetRoot, 'songshan.json'), {
      districtId: 'songshan',
      inputs: {},
    })

    const result = await runP2PromoteExpansion({
      districtId: 'songshan',
      sourceRoot,
      targetRoot,
      execute: true,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      `Target config already exists: ${path.join(targetRoot, 'songshan.json')}. Pass --overwrite only for an intentional re-promotion.`,
    )
  })
})
