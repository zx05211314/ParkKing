import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseP0ReviewIntakeArgs,
  renderP0ReviewIntake,
  runP0ReviewIntake,
} from './p0ReviewIntake'
import type { P0ValidatePriorityReviewOptions } from './p0ValidatePriorityReview'

const makeTempRoot = async () =>
  fs.mkdtemp(path.join(os.tmpdir(), 'p0-review-intake-'))

const writeText = async (targetPath: string, body: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, body, 'utf-8')
}

describe('p0ReviewIntake', () => {
  it('parses options', () => {
    expect(
      parseP0ReviewIntakeArgs([
        'node',
        'p0ReviewIntake',
        '--review-root',
        '.tmp',
        '--config-root',
        'configs/expansion',
        '--district',
        'daan,zhongshan',
        '--scan-dir',
        '.tmp/returned',
        '--include-common-dirs',
        '--publish-gate-summary',
        '.tmp/publish_gate_summary.json',
        '--max-files',
        '25',
        '--validate-ready',
        '--actionable-only',
        '--out',
        '.tmp/intake.md',
        '--json-out',
        '.tmp/intake.json',
        '--summary',
        '.tmp/summary.md',
        '--json',
      ]),
    ).toEqual({
      reviewRoot: '.tmp',
      configRoot: 'configs/expansion',
      districtIds: ['daan', 'zhongshan'],
      scanDirs: ['.tmp/returned'],
      includeCommonDirs: true,
      publishGateSummaryPath: '.tmp/publish_gate_summary.json',
      maxFiles: 25,
      validateReady: true,
      actionableOnly: true,
      outPath: '.tmp/intake.md',
      jsonOutPath: '.tmp/intake.json',
      summaryPath: '.tmp/summary.md',
      json: true,
    })
  })

  it('finds filled reviewer CSV rows and prints validation commands', async () => {
    const root = await makeTempRoot()
    const returnedCsv = path.join(root, 'daan-priority-review.csv')
    await writeText(
      returnedCsv,
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,2,seg-1,marked_space_park,LEGAL,observed legal curb sign,2026-05-16T00:00:00.000Z',
        'daan,3,seg-2,no_stop,ILLEGAL,observed no stopping sign,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      scanDirs: [root],
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('ready-to-validate')
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      districtId: 'daan',
      filePath: returnedCsv,
      reviewedRows: 2,
      validReviewedRows: 2,
      invalidStatusRows: 0,
      missingEvidenceRows: 0,
      nextAction: 'validate-priority-review',
    })
    expect(result.candidates[0]?.validationCommand).toContain(
      'npm run ops:p0-validate-priority-review -- --district daan',
    )
    expect(result.candidates[0]?.validationCommand?.replace(/\\/g, '/')).toContain(
      '--config "configs/expansion/daan.json"',
    )
    expect(renderP0ReviewIntake(result)).toContain('P0 review intake: READY-TO-VALIDATE')
  })

  it('can validate ready reviewer CSVs and surface finalize commands', async () => {
    const root = await makeTempRoot()
    const returnedCsv = path.join(root, 'daan-priority-review.csv')
    const validateCalls: P0ValidatePriorityReviewOptions[] = []
    await writeText(
      returnedCsv,
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,2,seg-1,marked_space_park,LEGAL,observed legal curb sign,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      configRoot: 'configs/expansion',
      scanDirs: [root],
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      validateReady: true,
      validatePriorityReview: async (options) => {
        validateCalls.push(options)
        return {
          pass: true,
          districtId: options.districtId ?? 'daan',
          sourcePath: options.sourcePath ?? path.join(root, 'daan-review.csv'),
          reviewsPath: options.reviewsPath ?? returnedCsv,
          filteredReviewsOutPath: path.join(root, 'daan-priority.filtered.csv'),
          mergedOutPath: path.join(root, 'daan-priority.merged.csv'),
          configPath: options.configPath ?? 'configs/prod/daan.json',
          outDir: options.outDir ?? path.join(root, 'overrides'),
          priorityRows: 1,
          filteredRows: 1,
          promote: null,
          finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
          errors: [],
          warnings: [],
        }
      },
    })

    expect(result.status).toBe('ready-to-finalize')
    expect(result.candidates[0]).toMatchObject({
      nextAction: 'finalize-review',
      finalizeCommand: 'npm run ops:p0-finalize-review -- --district daan',
    })
    expect(validateCalls[0]?.configPath?.replace(/\\/g, '/')).toBe(
      'configs/expansion/daan.json',
    )
    expect(renderP0ReviewIntake(result)).toContain('Finalize daan:')
  })

  it('keeps incomplete reviewed rows action-required instead of suggesting finalize', async () => {
    const root = await makeTempRoot()
    await writeText(
      path.join(root, 'zhongshan-next-review.csv'),
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'zhongshan,2,seg-1,marked_space_park,LEGAL,,2026-05-16T00:00:00.000Z',
        'zhongshan,3,seg-2,no_stop,MAYBE,observed sign,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      scanDirs: [root],
      districtIds: ['zhongshan'],
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(true)
    expect(result.status).toBe('action-required')
    expect(result.candidates[0]).toMatchObject({
      reviewedRows: 2,
      validReviewedRows: 0,
      invalidStatusRows: 1,
      missingEvidenceRows: 1,
      nextAction: 'fix invalid or incomplete reviewed rows',
      validationCommand: null,
    })
  })

  it('keeps reviewed rows with invalid timestamps out of validation-ready status', async () => {
    const root = await makeTempRoot()
    await writeText(
      path.join(root, 'daan-priority-review.csv'),
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,2,seg-1,marked_space_park,LEGAL,observed legal curb sign,not-a-date',
        '',
      ].join('\n'),
    )

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      scanDirs: [root],
      districtIds: ['daan'],
      publishGateSummaryPath: null,
    })

    expect(result.status).toBe('action-required')
    expect(result.candidates[0]).toMatchObject({
      reviewedRows: 1,
      validReviewedRows: 0,
      invalidTimestampRows: 1,
      nextAction: 'fix invalid or incomplete reviewed rows',
      validationCommand: null,
    })
    expect(renderP0ReviewIntake(result)).toContain('invalid timestamp 1')
  })

  it('can hide unsupported source CSVs from actionable returned-review reports', async () => {
    const root = await makeTempRoot()
    const sourceCsv = path.join(root, 'daan-review.csv')
    const handoffCsv = path.join(root, 'daan-human-review', 'daan-next-review.csv')
    const blankReturnedCopy = path.join(root, 'daan-next-review.csv')
    await writeText(
      sourceCsv,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,seg-1,marked_space_park,,,',
        '',
      ].join('\n'),
    )
    const handoffBody = [
      'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
      'daan,2,seg-1,marked_space_park,,,',
      '',
    ].join('\n')
    await writeText(handoffCsv, handoffBody)
    await writeText(blankReturnedCopy, handoffBody)

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      scanDirs: [root],
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      actionableOnly: true,
    })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      filePath: handoffCsv,
      isCanonicalHandoff: true,
      nextAction: 'fill review evidence',
    })
    expect(renderP0ReviewIntake(result)).not.toContain(sourceCsv)
    expect(renderP0ReviewIntake(result)).not.toContain(blankReturnedCopy)
  })

  it('keeps filled returned CSVs in actionable reports even outside bundle dirs', async () => {
    const root = await makeTempRoot()
    const returnedCsv = path.join(root, 'daan-priority-review.filtered.csv')
    await writeText(
      returnedCsv,
      [
        'districtId,sourceRowNumber,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,2,seg-1,marked_space_park,LEGAL,observed legal curb sign,2026-05-16T00:00:00.000Z',
        '',
      ].join('\n'),
    )

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      scanDirs: [root],
      districtIds: ['daan'],
      publishGateSummaryPath: null,
      actionableOnly: true,
    })

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      filePath: returnedCsv,
      isCanonicalHandoff: false,
      nextAction: 'validate-priority-review',
    })
  })

  it('blocks without a district filter', async () => {
    const root = await makeTempRoot()

    const result = await runP0ReviewIntake({
      reviewRoot: root,
      scanDirs: [root],
      publishGateSummaryPath: null,
    })

    expect(result.pass).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.errors).toContain('Pass at least one --district value.')
  })
})
