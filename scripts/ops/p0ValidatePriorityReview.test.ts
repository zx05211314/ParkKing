import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseP0ValidatePriorityReviewArgs,
  renderP0ValidatePriorityReview,
  runP0ValidatePriorityReview,
} from './p0ValidatePriorityReview'
import type { P0PromoteReviewResult } from './p0PromoteReviewTypes'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'p0-validate-priority-review-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

describe('p0ValidatePriorityReview', () => {
  it('parses options', () => {
    expect(
      parseP0ValidatePriorityReviewArgs([
        'node',
        'p0ValidatePriorityReview',
        '--district',
        'daan',
        '--source',
        '.tmp/daan-review.csv',
        '--reviews',
        '.tmp/human-review-priority.csv',
        '--filtered-reviews-out',
        '.tmp/daan-priority.filtered.csv',
        '--merged-out',
        '.tmp/daan-review.merged.csv',
        '--config',
        'configs/prod/daan.json',
        '--answer-cases',
        'configs/prod/daan.answer-cases.json',
        '--out-dir',
        '.tmp/overrides',
        '--allow-publish-warn',
        '--publish-override',
        'daan reviewed bootstrap',
        '--json',
      ]),
    ).toEqual({
      districtId: 'daan',
      sourcePath: '.tmp/daan-review.csv',
      reviewsPath: '.tmp/human-review-priority.csv',
      filteredReviewsOutPath: '.tmp/daan-priority.filtered.csv',
      mergedOutPath: '.tmp/daan-review.merged.csv',
      configPath: 'configs/prod/daan.json',
      answerCasesPath: 'configs/prod/daan.answer-cases.json',
      outDir: '.tmp/overrides',
      allowPublishWarn: true,
      allowPublishFail: false,
      publishOverrideReason: 'daan reviewed bootstrap',
      json: true,
    })
  })

  it('filters a multi-district priority CSV before running the P0 gate', async () => {
    const root = await makeTempRoot()
    const sourcePath = path.join(root, 'daan-review.csv')
    const reviewsPath = path.join(root, 'human-review-priority.csv')
    const filteredReviewsOutPath = path.join(root, 'daan-priority.filtered.csv')
    const mergedOutPath = path.join(root, 'daan-priority.merged.csv')
    const configPath = path.join(root, 'daan.json')
    const answerCasesPath = path.join(root, 'daan.answer-cases.json')
    const outDir = path.join(root, 'overrides')
    await writeText(sourcePath, 'districtId,segmentId,reviewBucket\n')
    await writeText(configPath, '{}\n')
    await writeText(
      reviewsPath,
      [
        'districtId,status,minimumNewReviews,rank,handoffRowNumber,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,ready-for-review,2,1,2,2,seg-1,marked_space_park,LEGAL,checked legal,2026-05-16T00:00:00.000Z',
        'zhongshan,ready-for-review,2,1,2,2,seg-z,marked_space_park,LEGAL,checked legal,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ValidatePriorityReview({
      districtId: 'daan',
      sourcePath,
      reviewsPath,
      filteredReviewsOutPath,
      mergedOutPath,
      configPath,
      answerCasesPath,
      outDir,
      allowPublishWarn: true,
      publishOverrideReason: 'daan reviewed bootstrap',
      promote: async (params): Promise<P0PromoteReviewResult> => ({
        pass: true,
        inputs: {
          districtId: params.districtId ?? 'daan',
          sourcePath: params.sourcePath ?? '',
          reviewsPath: params.reviewsPath ?? '',
          mergedOutPath: params.mergedOutPath ?? '',
          configPath: params.configPath ?? '',
          outDir: params.outDir ?? null,
        },
        apply: null,
        gate: null,
        errors: [],
        warnings: [],
      }),
    })

    expect(result.pass).toBe(true)
    expect(result.priorityRows).toBe(2)
    expect(result.filteredRows).toBe(1)
    await expect(fs.readFile(filteredReviewsOutPath, 'utf-8')).resolves.toContain(
      'daan,ready-for-review,2,1,2,2,seg-1',
    )
    await expect(fs.readFile(filteredReviewsOutPath, 'utf-8')).resolves.not.toContain(
      'zhongshan',
    )
    expect(result.finalizeCommand).toContain('--allow-publish-warn')
    expect(result.finalizeCommand).toContain(
      '--publish-override "daan reviewed bootstrap"',
    )
    expect(result.finalizeCommand).toContain(
      `--answer-cases "${path.resolve(answerCasesPath)}"`,
    )
    expect(renderP0ValidatePriorityReview(result)).toContain(
      'P0 priority review validation: PASS',
    )
  })

  it('blocks when no priority rows match the district', async () => {
    const root = await makeTempRoot()
    const reviewsPath = path.join(root, 'human-review-priority.csv')
    await writeText(
      reviewsPath,
      [
        'districtId,status,minimumNewReviews,rank,handoffRowNumber,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'zhongshan,ready-for-review,2,1,2,2,seg-z,marked_space_park,LEGAL,checked legal,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ValidatePriorityReview({
      districtId: 'daan',
      reviewsPath,
      filteredReviewsOutPath: path.join(root, 'daan-priority.filtered.csv'),
      promote: async () => {
        throw new Error('promote should not run')
      },
    })

    expect(result.pass).toBe(false)
    expect(result.promote).toBeNull()
    expect(result.errors).toContain('No priority review rows matched district daan.')
  })
})
