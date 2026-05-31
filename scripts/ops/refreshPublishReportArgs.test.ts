import { describe, expect, it } from 'vitest'
import { parseRefreshPublishReportArgs } from './refreshPublishReportArgs'

describe('parseRefreshPublishReportArgs', () => {
  it('parses config, dataset, output, time slots, and json flag', () => {
    expect(
      parseRefreshPublishReportArgs([
        'node',
        'refreshPublishReport',
        '--config',
        'configs/prod/xinyi.json',
        '--dataset',
        'public/data/generated/xinyi',
        '--out',
        '.tmp/report.json',
        '--day',
        '12:00',
        '--night',
        '22:00',
        '--json',
      ]),
    ).toEqual({
      configPath: 'configs/prod/xinyi.json',
      datasetDir: 'public/data/generated/xinyi',
      outPath: '.tmp/report.json',
      dayHhmm: '12:00',
      nightHhmm: '22:00',
      json: true,
    })
  })
})
