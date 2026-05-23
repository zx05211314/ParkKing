import * as fs from 'node:fs/promises'

export type QaReviewGateInputKind = 'csv' | 'reports'

export const resolveQaReviewGateInputKind = async (
  inputPath: string,
): Promise<QaReviewGateInputKind> => {
  const raw = await fs.readFile(inputPath, 'utf-8')
  const firstNonWhitespace = raw.trimStart().charAt(0)
  if (firstNonWhitespace === '{' || firstNonWhitespace === '[') {
    return 'reports'
  }
  return 'csv'
}
