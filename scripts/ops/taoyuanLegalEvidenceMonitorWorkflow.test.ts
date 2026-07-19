import * as fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Taoyuan legal evidence monitor workflow', () => {
  it('acquires, probes, summarizes, uploads, and deduplicates alerts daily', async () => {
    const workflow = await fs.readFile(
      '.github/workflows/taoyuan_legal_evidence_monitor.yml',
      'utf-8',
    )

    expect(workflow).toContain("cron: '30 2 * * *'")
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('issues: write')
    expect(workflow).toContain('TDX_ALLOW_GUEST: "true"')
    expect(workflow).toContain('npm run ops:fetch-taoyuan-paid-curb')
    expect(workflow).toContain(
      'npm run ops:monitor-taoyuan-legal-evidence',
    )
    expect(workflow).toContain('--timeout-ms 10000')
    expect(workflow).toContain(
      'review-evidence/taoyuan/legal-evidence-baseline.json',
    )
    expect(workflow).toContain('actions/upload-artifact@v7')
    expect(workflow).toContain('name: taoyuan-legal-evidence-monitor')
    expect(workflow).toContain(
      'npm run ops:notify-taoyuan-legal-evidence',
    )
    expect(workflow).toContain(
      "if: always() && steps.monitor.outputs.status != ''",
    )
  })
})
