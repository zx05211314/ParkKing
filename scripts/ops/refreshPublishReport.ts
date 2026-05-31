import { fileURLToPath } from 'node:url'
import { parseRefreshPublishReportArgs } from './refreshPublishReportArgs'
import { formatRefreshPublishReport } from './refreshPublishReportOutput'
import { buildRefreshPublishReport } from './refreshPublishReportState'

const run = async () => {
  const args = parseRefreshPublishReportArgs(process.argv)
  const result = await buildRefreshPublishReport({
    configPath: args.configPath ?? undefined,
    datasetDir: args.datasetDir ?? undefined,
    outPath: args.outPath ?? undefined,
    dayHhmm: args.dayHhmm ?? undefined,
    nightHhmm: args.nightHhmm ?? undefined,
  })

  console.log(args.json ? JSON.stringify(result.report, null, 2) : formatRefreshPublishReport(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
