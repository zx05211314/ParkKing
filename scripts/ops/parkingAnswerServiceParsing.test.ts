import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseParkingAnswerServiceRequest } from './parkingAnswerServiceParsing'
import type { ParkingAnswerServiceConfig } from './parkingAnswerServiceTypes'

const config: ParkingAnswerServiceConfig = {
  path: '/api/parking-answer',
  port: 8790,
  districtDatasetRoot: resolve('tmp/generated'),
  defaultDistrict: 'xinyi',
  allowedDistricts: ['xinyi'],
  defaultHhmm: '21:00',
  allowDatasetDirParam: false,
}

describe('parkingAnswerServiceParsing', () => {
  it('parses a district-scoped parking answer request', () => {
    expect(
      parseParkingAnswerServiceRequest(
        new URL(
          'http://localhost/api/parking-answer?district=xinyi&lng=121.56&lat=25.03&hhmm=22:30&radius=80&include-inferred=1&risk-mode=aggressive&max-alternatives=3',
        ),
        config,
      ),
    ).toEqual({
      ok: true,
      request: {
        district: 'xinyi',
        datasetDir: resolve('tmp/generated/xinyi'),
        lng: 121.56,
        lat: 25.03,
        hhmm: '22:30',
        searchRadiusMeters: 80,
        includeInferred: true,
        riskMode: 'AGGRESSIVE',
        maxAlternatives: 3,
      },
    })
  })

  it('supports location shorthand and defaults to the reviewed district', () => {
    expect(
      parseParkingAnswerServiceRequest(
        new URL('http://localhost/api/parking-answer?location=121.56,25.03'),
        config,
      ),
    ).toEqual({
      ok: true,
      request: {
        district: 'xinyi',
        datasetDir: resolve('tmp/generated/xinyi'),
        lng: 121.56,
        lat: 25.03,
        hhmm: '21:00',
        searchRadiusMeters: undefined,
        includeInferred: undefined,
        riskMode: undefined,
        maxAlternatives: undefined,
      },
    })
  })

  it('rejects disabled districts and arbitrary datasetDir reads by default', () => {
    expect(
      parseParkingAnswerServiceRequest(
        new URL(
          'http://localhost/api/parking-answer?district=daan&lng=121.56&lat=25.03',
        ),
        config,
      ),
    ).toEqual({
      ok: false,
      statusCode: 403,
      error: 'District "daan" is not enabled for parking-answer API.',
    })

    expect(
      parseParkingAnswerServiceRequest(
        new URL(
          'http://localhost/api/parking-answer?datasetDir=public/data/generated/xinyi&lng=121.56&lat=25.03',
        ),
        config,
      ),
    ).toEqual({
      ok: false,
      statusCode: 400,
      error: 'datasetDir query parameter is disabled for this service.',
    })
  })
})
