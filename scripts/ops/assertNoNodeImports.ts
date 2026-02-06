import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'

const importPattern =
  /(?:import\s+[^'"\n]*['"]node:[^'"\n]+['"]|import\s*\(\s*['"]node:[^'"\n]+['"]\s*\)|require\(\s*['"]node:[^'"\n]+['"]\s*\)|import\s+[^'"\n]*['"](fs|fs\/promises)['"]|import\s*\(\s*['"](fs|fs\/promises)['"]\s*\)|require\(\s*['"](fs|fs\/promises)['"]\s*\))/

const findNodeImports = async (filePath: string) => {
  const raw = await fs.readFile(filePath, 'utf-8')
  const lines = raw.split(/\r?\n/)
  const hits: Array<{ line: number; text: string }> = []
  lines.forEach((line, index) => {
    if (importPattern.test(line)) {
      hits.push({ line: index + 1, text: line.trim() })
    }
  })
  return hits
}

export const assertNoNodeImports = async () => {
  const files = await fg(['src/**/*.{ts,tsx}'], {
    onlyFiles: true,
    ignore: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.node.ts',
      '**/*.node.tsx',
      'src/tests/**',
    ],
  })

  const violations: Array<{ file: string; hits: Array<{ line: number; text: string }> }> = []

  for (const file of files) {
    const hits = await findNodeImports(file)
    if (hits.length > 0) {
      violations.push({ file, hits })
    }
  }

  if (violations.length > 0) {
    const lines = ['node:* imports detected in browser-targeted files:']
    violations.forEach((entry) => {
      const rel = path.relative(process.cwd(), entry.file).replace(/\\/g, '/')
      entry.hits.forEach((hit) => {
        lines.push(`- ${rel}:${hit.line} ${hit.text}`)
      })
    })
    throw new Error(lines.join('\n'))
  }
}

const run = async () => {
  await assertNoNodeImports()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
