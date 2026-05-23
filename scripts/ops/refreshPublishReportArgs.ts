export interface RefreshPublishReportArgs {
  configPath: string | null
  datasetDir: string | null
  outPath: string | null
  dayHhmm: string | null
  nightHhmm: string | null
  json: boolean
}

const findArgValue = (args: string[], names: string[]) => {
  const index = args.findIndex((arg) => names.includes(arg))
  return index >= 0 ? args[index + 1] ?? null : null
}

export const parseRefreshPublishReportArgs = (
  argv: string[],
): RefreshPublishReportArgs => {
  const args = [...argv]
  return {
    configPath: findArgValue(args, ['--config', '--configPath']),
    datasetDir: findArgValue(args, ['--dataset', '--datasetDir', '--dataset-dir']),
    outPath: findArgValue(args, ['--out', '--report', '--reportPath']),
    dayHhmm: findArgValue(args, ['--day', '--dayHhmm']),
    nightHhmm: findArgValue(args, ['--night', '--nightHhmm']),
    json: args.includes('--json'),
  }
}
