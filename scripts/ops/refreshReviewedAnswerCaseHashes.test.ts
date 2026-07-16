import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseRefreshReviewedAnswerCaseHashesArgs,
  refreshReviewedAnswerCaseHashes,
  renderRefreshReviewedAnswerCaseHashes,
} from './refreshReviewedAnswerCaseHashes'

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

const createFixture = async (districts: string[]) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'reviewed-case-semantic-repin-'),
  )
  const datasetRoot = path.join(root, 'generated')
  const answerCasesDir = path.join(root, 'configs')
  const originalCases = new Map<string, unknown[]>()

  for (const districtId of districts) {
    const cases = [
      {
        id: `${districtId}-reviewed-case`,
        lng: 121.5,
        lat: 25.05,
        expectedKind: 'PARK',
        expectedEvidenceKind: 'MARKED_SPACE',
        expectedPrimarySegmentId: 'seg-1',
      },
    ]
    originalCases.set(districtId, cases)
    await writeJson(
      path.join(answerCasesDir, `${districtId}.answer-cases.json`),
      {
        schemaVersion: 1,
        districtId,
        datasetHash: `${districtId}-old-hash`,
        cases,
      },
    )
    await writeJson(path.join(datasetRoot, districtId, 'dataset_meta.json'), {
      districtId,
      datasetHash: `${districtId}-new-hash`,
    })
  }

  return { datasetRoot, answerCasesDir, originalCases }
}

const readCases = async (answerCasesDir: string, districtId: string) =>
  JSON.parse(
    await fs.readFile(
      path.join(answerCasesDir, `${districtId}.answer-cases.json`),
      'utf-8',
    ),
  ) as { datasetHash: string; cases: unknown[] }

describe('refreshReviewedAnswerCaseHashes', () => {
  it('parses execution, paths, districts, and outputs', () => {
    expect(
      parseRefreshReviewedAnswerCaseHashesArgs([
        'node',
        'refresh',
        '--root',
        '.tmp/generated',
        '--answer-cases-dir',
        '.tmp/configs',
        '--district',
        'xinyi,daan',
        '--district',
        'xinyi',
        '--execute',
        '--out',
        '.tmp/repin.md',
        '--json-out',
        '.tmp/repin.json',
        '--json',
      ]),
    ).toEqual({
      datasetRoot: '.tmp/generated',
      answerCasesDir: '.tmp/configs',
      districtIds: ['xinyi', 'daan'],
      execute: true,
      outPath: '.tmp/repin.md',
      jsonOutPath: '.tmp/repin.json',
      json: true,
    })
  })

  it('updates only the hash after exact semantic validation passes', async () => {
    const fixture = await createFixture(['xinyi'])
    const validations: string[] = []
    const result = await refreshReviewedAnswerCaseHashes(
      {
        ...fixture,
        execute: true,
      },
      {
        validateSemantics: async ({ datasetDir, casesPath, caseCount }) => {
          validations.push(`${path.basename(datasetDir)}:${path.basename(casesPath)}:${caseCount}`)
        },
      },
    )
    const written = await readCases(fixture.answerCasesDir, 'xinyi')

    expect(result).toMatchObject({
      pass: true,
      execute: true,
      refreshed: [
        {
          districtId: 'xinyi',
          semanticValidationPassed: true,
          status: 'repinned',
          previousDatasetHash: 'xinyi-old-hash',
          runtimeDatasetHash: 'xinyi-new-hash',
        },
      ],
    })
    expect(validations).toEqual(['xinyi:xinyi.answer-cases.json:1'])
    expect(written.datasetHash).toBe('xinyi-new-hash')
    expect(written.cases).toEqual(fixture.originalCases.get('xinyi'))
  })

  it('validates but does not write in report-only mode', async () => {
    const fixture = await createFixture(['xinyi'])
    const result = await refreshReviewedAnswerCaseHashes(
      fixture,
      { validateSemantics: async () => undefined },
    )

    expect(result.pass).toBe(true)
    expect(result.refreshed[0]?.status).toBe('would-repin')
    expect((await readCases(fixture.answerCasesDir, 'xinyi')).datasetHash).toBe(
      'xinyi-old-hash',
    )
    expect(renderRefreshReviewedAnswerCaseHashes(result)).toContain(
      'hash mismatch is ignored only during exact semantic validation',
    )
  })

  it('writes no district when any semantic validation fails', async () => {
    const fixture = await createFixture(['daan', 'xinyi'])
    const result = await refreshReviewedAnswerCaseHashes(
      {
        ...fixture,
        execute: true,
      },
      {
        validateSemantics: async ({ datasetDir }) => {
          if (path.basename(datasetDir) === 'xinyi') {
            throw new Error('expected evidence changed')
          }
        },
      },
    )

    expect(result.pass).toBe(false)
    expect(result.refreshed.map(({ status }) => status)).toEqual([
      'blocked',
      'failed',
    ])
    expect((await readCases(fixture.answerCasesDir, 'daan')).datasetHash).toBe(
      'daan-old-hash',
    )
    expect((await readCases(fixture.answerCasesDir, 'xinyi')).datasetHash).toBe(
      'xinyi-old-hash',
    )
    expect(result.errors).toContain(
      'No answer-case hashes were written because at least one district failed semantic validation.',
    )
  })

  it('keeps release workflow repin before reviewed UI smoke and preserves reports', async () => {
    const workflow = await fs.readFile(
      path.resolve('.github/workflows/release_data.yml'),
      'utf-8',
    )
    const ingestIndex = workflow.indexOf('name: Ingest and publish')
    const repinIndex = workflow.indexOf('name: Re-pin reviewed answer cases')
    const smokeIndex = workflow.indexOf('name: Smoke reviewed UI answers')

    expect(ingestIndex).toBeGreaterThan(-1)
    expect(repinIndex).toBeGreaterThan(ingestIndex)
    expect(smokeIndex).toBeGreaterThan(repinIndex)
    expect(workflow).toContain('.tmp/reviewed-answer-case-repin.md')
    expect(workflow).toContain('.tmp/reviewed-answer-case-repin.json')
  })
})
