import * as fs from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  discoverParkingAnswerServiceDistricts,
  resolveParkingAnswerServiceConfig,
} from './parkingAnswerServiceConfig'

const makeDatasetRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'parking-answer-config-'))
  await fs.writeFile(
    path.join(root, 'registry.json'),
    JSON.stringify({
      districts: [
        { districtId: 'zhongshan' },
        { districtId: 'xinyi' },
        { districtId: 'daan' },
      ],
    }),
  )
  return root
}

describe('discoverParkingAnswerServiceDistricts', () => {
  it('discovers allowed districts from the generated registry', async () => {
    const root = await makeDatasetRoot()

    expect(discoverParkingAnswerServiceDistricts(root)).toEqual([
      'daan',
      'xinyi',
      'zhongshan',
    ])
  })
})

describe('resolveParkingAnswerServiceConfig', () => {
  it('uses registry districts when no explicit allow-list is configured', async () => {
    const root = await makeDatasetRoot()

    const config = resolveParkingAnswerServiceConfig(
      { PARKKING_PARKING_ANSWER_DATASET_ROOT: root },
      process.cwd(),
    )

    expect(config.allowedDistricts).toEqual(['daan', 'xinyi', 'zhongshan'])
  })

  it('keeps explicit allow-list precedence over registry discovery', async () => {
    const root = await makeDatasetRoot()

    const config = resolveParkingAnswerServiceConfig(
      {
        PARKKING_PARKING_ANSWER_DATASET_ROOT: root,
        PARKKING_PARKING_ANSWER_DISTRICTS: 'xinyi',
      },
      process.cwd(),
    )

    expect(config.allowedDistricts).toEqual(['xinyi'])
  })

  it('requires the build-time index by default in production', async () => {
    const root = await makeDatasetRoot()
    const cwd = process.cwd()

    const config = resolveParkingAnswerServiceConfig(
      {
        NODE_ENV: 'production',
        PARKKING_PARKING_ANSWER_DATASET_ROOT: root,
      },
      cwd,
    )

    expect(config.preparedIndexRoot).toBe(
      path.resolve(cwd, '.tmp/parking-answer-index'),
    )
  })
})
