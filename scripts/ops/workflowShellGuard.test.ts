import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const WORKFLOW_DIR = path.resolve('.github/workflows')

const guardedPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'explicit bash shell', pattern: /^\s*shell:\s*bash\b/m },
  { label: 'multi-command run block', pattern: /^\s*run:\s*\|/m },
  { label: 'inline node command', pattern: /\bnode\s+-e\b/ },
  { label: 'eval command assembly', pattern: /\beval\s+/ },
  { label: 'shell env expansion', pattern: /\$[A-Z_][A-Z0-9_]*/ },
  { label: 'tee pipe logging', pattern: /\btee\s+/ },
  { label: 'pipefail shell option', pattern: /\bset\s+-o\s+pipefail\b/ },
  { label: 'test bracket file check', pattern: /\[\s+-[fn]\b/ },
  { label: 'find pipe count', pattern: /\bfind\b[\s\S]*\|\s*wc\b/ },
  { label: 'summary append redirection', pattern: />>\s*["']?\$GITHUB_STEP_SUMMARY/ },
]

const loadWorkflowFiles = async () => {
  const entries = await fs.readdir(WORKFLOW_DIR, { withFileTypes: true })
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(WORKFLOW_DIR, entry.name)
        return {
          filePath,
          content: await fs.readFile(filePath, 'utf-8'),
        }
      }),
  )
}

describe('workflowShellGuard', () => {
  it('keeps GitHub workflows on Node wrappers instead of shell glue', async () => {
    const violations: string[] = []

    for (const workflow of await loadWorkflowFiles()) {
      for (const guard of guardedPatterns) {
        if (guard.pattern.test(workflow.content)) {
          violations.push(`${path.relative(process.cwd(), workflow.filePath)}: ${guard.label}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
