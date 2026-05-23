import { describe, expect, it } from 'vitest'
import {
  parseWorkflowPublishIngestArgs,
  resolveWorkflowPublishIngestArgv,
  runWorkflowPublishIngest,
} from './workflowPublishIngest'

describe('workflowPublishIngest', () => {
  it('parses explicit publish ingest options', () => {
    expect(
      parseWorkflowPublishIngestArgs([
        'node',
        'workflow-publish-ingest',
        '--configs-env',
        'CONFIGS_GLOB',
        '--allow-warn-env',
        'ALLOW_WARN',
        '--override-env',
        'OVERRIDE_REASON',
      ]),
    ).toEqual({
      configs: null,
      configsEnv: 'CONFIGS_GLOB',
      allowWarn: null,
      allowWarnEnv: 'ALLOW_WARN',
      overrideReason: null,
      overrideReasonEnv: 'OVERRIDE_REASON',
    })
  })

  it('builds safe ingest argv from workflow env', () => {
    expect(
      resolveWorkflowPublishIngestArgv(
        {},
        {
          CONFIGS_GLOB: 'configs/prod/*.json',
          ALLOW_WARN: 'true',
          OVERRIDE_REASON: 'reviewed bootstrap',
        },
      ),
    ).toEqual([
      'node',
      'ingestAll',
      '--configs',
      'configs/prod/*.json',
      '--allowWarn',
      '--override',
      'reviewed bootstrap',
    ])
  })

  it('rejects allowWarn without an override reason', () => {
    expect(() =>
      resolveWorkflowPublishIngestArgv(
        {},
        {
          CONFIGS_GLOB: 'configs/prod/*.json',
          ALLOW_WARN: 'true',
        },
      ),
    ).toThrow('overrideReason is required when allowWarn=true')
  })

  it('runs the provided ingest runner with resolved argv', async () => {
    const calls: string[][] = []
    const argv = await runWorkflowPublishIngest(
      { configs: 'configs/prod/xinyi.json' },
      {},
      async (resolvedArgv) => {
        calls.push(resolvedArgv)
      },
    )

    expect(argv).toEqual(['node', 'ingestAll', '--configs', 'configs/prod/xinyi.json'])
    expect(calls).toEqual([argv])
  })
})
