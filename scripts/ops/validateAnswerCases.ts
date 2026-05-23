import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import {
  loadSmokeExactParkingAnswerCases,
  type SmokeExactParkingAnswerCase,
  type SmokeExactParkingAnswerCaseFile,
} from './smokeExactParkingAnswers'

export interface ValidateAnswerCasesOptions {
  casesGlob?: string
  minCases?: number
  requirePinned?: boolean
  requireUiCompatibleTimes?: boolean
  requirePrimarySegment?: boolean
  requireEvidenceKind?: boolean
  requireFinalConfidence?: boolean
  allowInferredCases?: boolean
  allowMissing?: boolean
}

export interface ValidateAnswerCaseFileIssue {
  casesPath: string
  districtId: string | null
  caseCount: number
  errors: string[]
  warnings: string[]
}

const DEFAULT_CASES_GLOB = 'configs/prod/*.answer-cases.json'
const DEFAULT_MIN_CASES = 1

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const parseNonNegativeInteger = (value: string | null, label: string) => {
  if (value === null) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return parsed
}

export const parseValidateAnswerCasesArgs = (
  argv: string[],
): ValidateAnswerCasesOptions => ({
  casesGlob:
    getArgValue(argv, '--cases', '--casesGlob', '--cases-glob') ??
    DEFAULT_CASES_GLOB,
  minCases:
    parseNonNegativeInteger(getArgValue(argv, '--min-cases', '--minCases'), 'min-cases') ??
    DEFAULT_MIN_CASES,
  requirePinned: !hasFlag(argv, '--allow-unpinned-cases', '--allowUnpinnedCases'),
  requireUiCompatibleTimes: !hasFlag(
    argv,
    '--allow-non-ui-times',
    '--allowNonUiTimes',
  ),
  requirePrimarySegment: !hasFlag(
    argv,
    '--allow-missing-primary-segment',
    '--allowMissingPrimarySegment',
  ),
  requireEvidenceKind: !hasFlag(
    argv,
    '--allow-missing-evidence-kind',
    '--allowMissingEvidenceKind',
  ),
  requireFinalConfidence: !hasFlag(
    argv,
    '--allow-missing-final-confidence',
    '--allowMissingFinalConfidence',
  ),
  allowInferredCases: hasFlag(argv, '--allow-inferred-cases', '--allowInferredCases'),
  allowMissing: hasFlag(argv, '--allow-missing', '--allowMissing'),
})

const expectedDistrictIdFromPath = (casesPath: string) => {
  const basename = path.basename(casesPath)
  const suffix = '.answer-cases.json'
  return basename.endsWith(suffix) ? basename.slice(0, -suffix.length) : null
}

const isUiCompatibleHhmm = (hhmm: string | undefined) => {
  const normalized = hhmm ?? '21:00'
  return normalized === '13:00' || normalized === '21:00'
}

const isNoDataCase = (answerCase: SmokeExactParkingAnswerCase) =>
  answerCase.expectedKind === 'NO_DATA'

const validateCase = (params: {
  answerCase: SmokeExactParkingAnswerCase
  caseIndex: number
  options: Required<
    Pick<
      ValidateAnswerCasesOptions,
      | 'requireUiCompatibleTimes'
      | 'requirePrimarySegment'
      | 'requireEvidenceKind'
      | 'requireFinalConfidence'
      | 'allowInferredCases'
    >
  >
}) => {
  const { answerCase, caseIndex, options } = params
  const errors: string[] = []
  const label = `case ${answerCase.id || caseIndex + 1}`

  if (options.requireUiCompatibleTimes && !isUiCompatibleHhmm(answerCase.hhmm)) {
    errors.push(`${label}: hhmm must be 13:00 or 21:00 for publish UI smoke`)
  }
  if (
    options.requirePrimarySegment &&
    !isNoDataCase(answerCase) &&
    !answerCase.expectedPrimarySegmentId
  ) {
    errors.push(`${label}: expectedPrimarySegmentId is required`)
  }
  if (
    options.requireEvidenceKind &&
    !isNoDataCase(answerCase) &&
    !answerCase.expectedEvidenceKind
  ) {
    errors.push(`${label}: expectedEvidenceKind is required`)
  }
  if (
    options.requireFinalConfidence &&
    !isNoDataCase(answerCase) &&
    !answerCase.expectedFinalConfidence
  ) {
    errors.push(`${label}: expectedFinalConfidence is required`)
  }
  if (!options.allowInferredCases && answerCase.includeInferred) {
    errors.push(
      `${label}: includeInferred=true is not compatible with publish UI smoke share links`,
    )
  }

  return errors
}

export const validateAnswerCaseFile = (
  casesPath: string,
  caseFile: SmokeExactParkingAnswerCaseFile,
  options: ValidateAnswerCasesOptions = {},
): ValidateAnswerCaseFileIssue => {
  const normalizedOptions = {
    minCases: options.minCases ?? DEFAULT_MIN_CASES,
    requirePinned: options.requirePinned ?? true,
    requireUiCompatibleTimes: options.requireUiCompatibleTimes ?? true,
    requirePrimarySegment: options.requirePrimarySegment ?? true,
    requireEvidenceKind: options.requireEvidenceKind ?? true,
    requireFinalConfidence: options.requireFinalConfidence ?? true,
    allowInferredCases: options.allowInferredCases ?? false,
  }
  const errors: string[] = []
  const warnings: string[] = []
  const expectedDistrictId = expectedDistrictIdFromPath(casesPath)

  if (!caseFile.districtId) {
    errors.push('districtId is required')
  } else if (expectedDistrictId && caseFile.districtId !== expectedDistrictId) {
    errors.push(
      `districtId ${caseFile.districtId} does not match file name ${expectedDistrictId}`,
    )
  }
  if (normalizedOptions.requirePinned && !caseFile.datasetHash) {
    errors.push('datasetHash is required')
  }
  if (caseFile.cases.length < normalizedOptions.minCases) {
    errors.push(
      `cases count ${caseFile.cases.length} below required ${normalizedOptions.minCases}`,
    )
  }

  const ids = new Map<string, number>()
  caseFile.cases.forEach((answerCase, index) => {
    const previousIndex = ids.get(answerCase.id)
    if (previousIndex !== undefined) {
      errors.push(
        `case ${answerCase.id}: duplicate id also used at index ${previousIndex + 1}`,
      )
    } else {
      ids.set(answerCase.id, index)
    }
    errors.push(
      ...validateCase({
        answerCase,
        caseIndex: index,
        options: normalizedOptions,
      }),
    )
  })

  return {
    casesPath,
    districtId: caseFile.districtId ?? null,
    caseCount: caseFile.cases.length,
    errors,
    warnings,
  }
}

export const validateAnswerCases = async (
  options: ValidateAnswerCasesOptions = {},
) => {
  const casesGlob = options.casesGlob ?? DEFAULT_CASES_GLOB
  const files = await fg(casesGlob, { onlyFiles: true, dot: false, absolute: false })
  const issues: ValidateAnswerCaseFileIssue[] = []

  if (files.length === 0 && !options.allowMissing) {
    issues.push({
      casesPath: casesGlob,
      districtId: null,
      caseCount: 0,
      errors: [`No answer case files matched ${casesGlob}`],
      warnings: [],
    })
  }

  for (const casesPath of files) {
    try {
      const caseFile = await loadSmokeExactParkingAnswerCases(casesPath)
      issues.push(validateAnswerCaseFile(casesPath, caseFile, options))
    } catch (error) {
      issues.push({
        casesPath,
        districtId: null,
        caseCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      })
    }
  }

  return {
    issues,
    hasErrors: issues.some((issue) => issue.errors.length > 0),
  }
}

export const renderValidateAnswerCasesResult = (
  issues: ValidateAnswerCaseFileIssue[],
) => {
  if (issues.length === 0) {
    return 'Answer case validation: no files matched.'
  }

  const lines = ['Answer case validation:']
  issues.forEach((issue) => {
    const status = issue.errors.length > 0 ? 'FAIL' : 'PASS'
    lines.push(
      `- ${status} ${issue.casesPath} (${issue.districtId ?? '-'}, ${issue.caseCount} cases)`,
    )
    issue.errors.forEach((error) => {
      lines.push(`  ERROR: ${error}`)
    })
    issue.warnings.forEach((warning) => {
      lines.push(`  WARN: ${warning}`)
    })
  })
  return lines.join('\n')
}

const run = async () => {
  const result = await validateAnswerCases(parseValidateAnswerCasesArgs(process.argv))
  console.log(renderValidateAnswerCasesResult(result.issues))
  if (result.hasErrors) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
