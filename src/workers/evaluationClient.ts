import type { WorkerEvaluatedPayload, WorkerInitPayload, WorkerResponse } from './protocol'

export interface WorkerLike {
  postMessage: (message: unknown) => void
  terminate?: () => void
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface EvaluationWorkerCallbacks {
  onEvaluated: (payload: WorkerEvaluatedPayload) => void
  onInit?: () => void
  onError?: (message?: string) => void
}

export class EvaluationWorkerClient {
  private latestRequestId = 0
  private ready = false
  private callbacks: EvaluationWorkerCallbacks
  private worker: WorkerLike

  constructor(worker: WorkerLike, callbacks: EvaluationWorkerCallbacks) {
    this.worker = worker
    this.callbacks = callbacks
    this.worker.onmessage = (event) => this.handleMessage(event)
    this.worker.onerror = () => {
      this.callbacks.onError?.('Worker error')
    }
  }

  init(payload: WorkerInitPayload) {
    this.ready = false
    this.worker.postMessage({ type: 'init', payload })
  }

  evaluate(nowHHMM: string) {
    const requestId = ++this.latestRequestId
    this.worker.postMessage({
      type: 'evaluate',
      payload: { nowHHMM, requestId },
    })
    return requestId
  }

  handleMessage(event: MessageEvent) {
    const data = event.data as WorkerResponse
    if (data.type === 'init-complete') {
      this.ready = true
      this.callbacks.onInit?.()
      return
    }

    if (data.type === 'evaluated') {
      if (!data.payload || data.payload.requestId !== this.latestRequestId) {
        return
      }
      this.callbacks.onEvaluated(data.payload)
      return
    }

    if (data.type === 'error') {
      this.callbacks.onError?.(data.message)
    }
  }

  resetRequestId() {
    this.latestRequestId = 0
  }

  isReady() {
    return this.ready
  }

  getLatestRequestId() {
    return this.latestRequestId
  }

  terminate() {
    this.worker.terminate?.()
  }
}
