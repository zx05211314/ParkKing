import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Taoyuan source review handoff workflow', () => {
  it('builds, validates, packages, summarizes, and uploads the city handoff', async () => {
    const workflow = await fs.readFile(
      '.github/workflows/taoyuan_source_review_handoff.yml',
      'utf-8',
    )

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('npm run ops:build-taoyuan-review-all')
    expect(workflow).toContain('npm run ops:taoyuan-review-index')
    expect(workflow).toContain('npm run ops:package-taoyuan-reviews')
    expect(workflow).toContain(
      '--append-file .tmp/taoyuan-city-review-status.md',
    )
    expect(workflow).toContain(
      '--append-file .tmp/taoyuan-source-review-handoff.md',
    )
    expect(workflow).toContain('actions/upload-artifact@v7')
    expect(workflow).toContain('name: taoyuan-source-review-handoff')
    expect(workflow).toContain('retention-days: 30')
  })
})
