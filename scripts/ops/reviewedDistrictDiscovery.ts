import * as path from 'node:path'
import fg from 'fast-glob'

export const DEFAULT_REVIEWED_ANSWER_CASES_GLOB =
  'configs/prod/*.answer-cases.json'

export const discoverReviewedDistrictIds = async (
  answerCasesGlob = DEFAULT_REVIEWED_ANSWER_CASES_GLOB,
) => {
  const files = await fg(answerCasesGlob, {
    onlyFiles: true,
    dot: false,
    absolute: false,
  })
  return files
    .map((file) => path.basename(file, '.answer-cases.json'))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}
