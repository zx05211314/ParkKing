// @vitest-environment node
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { getDatasetBaseDir } from './datasetResolver'

type EnvSnapshot = {
  DATASET_DIR?: string
  NODE_ENV?: string
  VITEST?: string
}

const snapshotEnv = (): EnvSnapshot => ({
  DATASET_DIR: process.env.DATASET_DIR,
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
})

const restoreEnv = (snapshot: EnvSnapshot) => {
  if (snapshot.DATASET_DIR === undefined) {
    delete process.env.DATASET_DIR
  } else {
    process.env.DATASET_DIR = snapshot.DATASET_DIR
  }
  if (snapshot.NODE_ENV === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = snapshot.NODE_ENV
  }
  if (snapshot.VITEST === undefined) {
    delete process.env.VITEST
  } else {
    process.env.VITEST = snapshot.VITEST
  }
}

describe('getDatasetBaseDir (node)', () => {
  let envSnapshot: EnvSnapshot

  beforeEach(() => {
    envSnapshot = snapshotEnv()
  })

  afterEach(() => {
    restoreEnv(envSnapshot)
  })

  it('appends dataset id when DATASET_DIR is a root directory', () => {
    process.env.DATASET_DIR = 'C:/data/generated'
    const result = getDatasetBaseDir('daan')
    expect(result).toBe('C:/data/generated/daan')
  })

  it('returns DATASET_DIR when it already points at the dataset', () => {
    process.env.DATASET_DIR = 'C:/data/generated/daan'
    const result = getDatasetBaseDir('daan')
    expect(result).toBe('C:/data/generated/daan')
  })

  it('uses default dataset id when none provided', () => {
    process.env.DATASET_DIR = 'C:/data/generated'
    const result = getDatasetBaseDir()
    expect(result).toBe('C:/data/generated/xinyi')
  })

  it('falls back to public/data/generated outside test env when DATASET_DIR is unset', () => {
    delete process.env.DATASET_DIR
    process.env.NODE_ENV = 'production'
    delete process.env.VITEST

    const result = getDatasetBaseDir('daan')
    expect(result).toBe('public/data/generated/daan')
  })
})
