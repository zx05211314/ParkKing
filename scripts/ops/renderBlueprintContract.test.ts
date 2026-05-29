import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  checkRenderBlueprintContract,
  parseRenderBlueprint,
  validateRenderBlueprintContract,
} from './renderBlueprintContract'

describe('renderBlueprintContract', () => {
  it('passes the checked-in Render blueprint', async () => {
    const result = await checkRenderBlueprintContract('render.yaml')

    expect(result.pass).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.checkedEnvVars).toContain('PARKKING_RELEASE_PACKAGE_URL')
    expect(result.checkedEnvVars).toContain('PARKKING_PARKING_ANSWER_DATASET_ROOT')
  })

  it('parses quoted and unquoted service and env values', () => {
    const service = parseRenderBlueprint(`
services:
  - type: web
    name: "parkking"
    runtime: node
    buildCommand: npm ci && npm run ops:install-release-package -- --require-manifest && npm run build
    startCommand: npm start
    healthCheckPath: /api/parking-answer/ready
    envVars:
      - key: NODE_ENV
        value: "production"
      - key: PARKKING_RELEASE_PACKAGE_URL
        sync: false
`)

    expect(service).toMatchObject({
      type: 'web',
      name: 'parkking',
      runtime: 'node',
      envVars: [
        {
          key: 'NODE_ENV',
          value: 'production',
        },
        {
          key: 'PARKKING_RELEASE_PACKAGE_URL',
          sync: 'false',
        },
      ],
    })
  })

  it('fails when release asset env vars are synced into source control', async () => {
    const content = await fs.readFile('render.yaml', 'utf-8')
    const service = parseRenderBlueprint(
      content.replace(
        /- key: PARKKING_RELEASE_PACKAGE_URL\s+sync: false/,
        '- key: PARKKING_RELEASE_PACKAGE_URL\n        value: https://example.test/data.zip',
      ),
    )

    const result = validateRenderBlueprintContract(service)

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'PARKKING_RELEASE_PACKAGE_URL must be declared with sync: false',
    )
  })

  it('fails when health check or build install contract drifts', async () => {
    const content = await fs.readFile('render.yaml', 'utf-8')
    const service = parseRenderBlueprint(
      content
        .replace(
          'buildCommand: npm ci && npm run ops:install-release-package -- --require-manifest && npm run build',
          'buildCommand: npm ci && npm run build',
        )
        .replace(
          'healthCheckPath: /api/parking-answer/ready',
          'healthCheckPath: /api/app/ready',
        ),
    )

    const result = validateRenderBlueprintContract(service)

    expect(result.pass).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'buildCommand must be "npm ci && npm run ops:install-release-package -- --require-manifest && npm run build"',
    )
    expect(result.errors.join('\n')).toContain(
      'healthCheckPath must be "/api/parking-answer/ready"',
    )
  })
})
