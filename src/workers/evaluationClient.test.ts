import { describe, expect, it } from 'vitest'
import { EvaluationWorkerClient, type WorkerLike } from './evaluationClient'

class MockWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  sent: unknown[] = []

  postMessage(message: unknown) {
    this.sent.push(message)
  }

  terminate() {
    // no-op for mock
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent)
  }
}

describe('EvaluationWorkerClient', () => {
  it('ignores stale worker responses', () => {
    const worker = new MockWorker()
    const applied: number[] = []

    const client = new EvaluationWorkerClient(worker, {
      onEvaluated: (payload) => {
        applied.push(payload.requestId)
      },
    })

    const first = client.evaluate('13:00')
    const second = client.evaluate('21:00')

    worker.emit({ type: 'evaluated', payload: { segments: [], requestId: first } })
    worker.emit({ type: 'evaluated', payload: { segments: [], requestId: second } })

    expect(applied).toEqual([second])
  })
})
