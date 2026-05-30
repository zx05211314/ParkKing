import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const readWorkflow = async (name: string) =>
  await fs.readFile(path.resolve('.github/workflows', name), 'utf-8')

const expectCommandsInOrder = (content: string, commands: string[]) => {
  let cursor = 0
  const missing: string[] = []
  for (const command of commands) {
    const index = content.indexOf(command, cursor)
    if (index < 0) {
      missing.push(command)
      continue
    }
    cursor = index + command.length
  }
  expect(missing).toEqual([])
}

describe('release workflow contracts', () => {
  it('keeps Release Data Package guarded before publishing assets', async () => {
    const workflow = await readWorkflow('release_data.yml')

    expectCommandsInOrder(workflow, [
      'npm run ops:render-blueprint-check',
      'npm run ops:workflow-publish-ingest',
      'npm run build',
      'npm run ops:bundle-budget',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --timeout-ms 25000',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --view MAP --limit 1 --timeout-ms 25000',
      'npm run ops:p3-release-readiness',
      'npm run ops:deploy-readiness',
      'npm run ops:render-deployment-handoff',
      'npm run ops:release-data-publish',
      'npm run ops:release-data-url-smoke',
    ])
  })

  it('keeps Publish Packs guarded by reviewed UI smokes before release gates', async () => {
    const workflow = await readWorkflow('publish.yml')

    expectCommandsInOrder(workflow, [
      'npm run ops:render-blueprint-check',
      'npm run ops:workflow-publish-ingest',
      'npm run ops:smoke-generated-packs -- --root public/data/generated --registry public/data/generated/registry.json --use-reviewed-cases --reviewed',
      'npm run ops:smoke-parking-answer-apis -- --root public/data/generated --registry public/data/generated/registry.json --use-reviewed-cases --reviewed --timeout-ms 25000',
      'npm run build',
      'npm run ops:bundle-budget',
      'npm run ops:smoke-api-services -- --start-preview --timeout-ms 25000 --sync-issue-roundtrip',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --timeout-ms 25000',
      'npm run ops:smoke-reviewed-ui-packs -- --root public/data/generated --registry public/data/generated/registry.json --reviewed --view MAP --limit 1 --timeout-ms 25000',
      'npm run ops:p1-release-readiness',
      'npm run ops:p3-release-readiness',
      'npm run ops:deploy-readiness',
      'npm run ops:render-deployment-handoff',
    ])
  })
})
