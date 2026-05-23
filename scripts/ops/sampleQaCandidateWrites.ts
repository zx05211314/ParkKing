import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { renderQaCandidatesCsv } from './sampleQaCandidateCsv'
import { resolveQaOutPath } from './sampleQaCandidatePaths'
import type { QaCandidateRow } from './sampleQaCandidateTypes'

export const writeQaCandidates = async (params: {
  districtId: string
  all: boolean
  outPath: string | null
  rows: QaCandidateRow[]
}) => {
  const outPath = resolveQaOutPath({
    districtId: params.districtId,
    all: params.all,
    outPath: params.outPath,
  })
  const csv = renderQaCandidatesCsv(params.rows)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, csv, 'utf-8')
  return outPath
}
