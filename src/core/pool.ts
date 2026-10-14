import { Worker } from 'node:worker_threads';
import type { Config } from '../config.js';
import { log } from '../config.js';
import { FormaError } from './errors.js';
import type { RenderRequest, RenderResult } from './types.js';

interface Job {
  request: RenderRequest;
  resolve: (result: RenderResult) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
}
interface Slot {
  worker: Worker;
  ready: boolean;
  retired: boolean;
  job?: Job;
  startupTimer?: ReturnType<typeof setTimeout>;
}

export class RenderPool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private closed = false;
  constructor(
    private config: Config,
    private workerUrl = new URL('./worker.js', import.meta.url),
  ) {}
  async start() {
    try {
      await Promise.all(Array.from({ length: this.config.concurrency }, () => this.spawn()));
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  get healthy() {
    return !this.closed && this.slots.some(slot => slot.ready && !slot.retired);
  }
  get stats() {
    return {
      workers: this.slots.filter(s => s.ready && !s.retired).length,
      active: this.slots.filter(s => s.job).length,
      queued: this.queue.length,
    };
  }

  private spawn(): Promise<void> {
    if (this.closed) return Promise.resolve();
    const worker = new Worker(this.workerUrl, { workerData: this.config });
    const slot: Slot = { worker, ready: false, retired: false };
    this.slots.push(slot);
    return new Promise((resolve, reject) => {
      const startupTimer = setTimeout(() => fail(new Error('Render worker startup timed out')), 30000);
      slot.startupTimer = startupTimer;
      const fail = (error: Error) => {
        if (slot.retired) return;
        clearTimeout(startupTimer);
        const wasReady = slot.ready;
        this.retire(slot, new FormaError('WORKER_FAILED', 'Render worker failed', 503), wasReady);
        if (!wasReady) reject(error);
      };
      worker.on('error', fail);
      worker.on('exit', code => {
        if (!slot.retired) fail(new Error('Worker exited: ' + code));
      });
      worker.on('message', message => {
        if (slot.retired) return;
        if (message.ready) {
          clearTimeout(startupTimer);
          slot.ready = true;
          resolve();
          this.drain();
          return;
        }
        const job = slot.job;
        if (!job) return;
        slot.job = undefined;
        job.cleanup();
        if (message.error) {
          const e = message.error;
          job.reject(new FormaError(e.code, e.message, e.status, e.details));
        } else job.resolve(message.result);
        this.drain();
      });
    });
  }

  render(request: RenderRequest, signal?: AbortSignal, timeoutMs = this.config.timeoutMs): Promise<RenderResult> {
    if (this.closed || this.slots.length === 0)
      return Promise.reject(new FormaError('UNAVAILABLE', 'Renderer is unavailable', 503));
    if (signal?.aborted) return Promise.reject(new FormaError('CANCELLED', 'Request cancelled', 499));
    if (this.queue.length >= this.config.queueLimit && !this.slots.some(s => s.ready && !s.job)) {
      return Promise.reject(new FormaError('BUSY', 'Render queue is full; retry later', 503));
    }
    return new Promise((resolve, reject) => {
      const cancel = (error: FormaError) => {
        const index = this.queue.indexOf(job);
        if (index >= 0) {
          this.queue.splice(index, 1);
          job.cleanup();
          reject(error);
        } else {
          const slot = this.slots.find(s => s.job === job);
          if (slot) this.retire(slot, error, true);
        }
      };
      const timer = setTimeout(
        () => cancel(new FormaError('RENDER_TIMEOUT', 'Render deadline exceeded', 504)),
        Math.max(1, timeoutMs),
      );
      const abort = () => cancel(new FormaError('CANCELLED', 'Request cancelled', 499));
      const job: Job = {
        request,
        resolve,
        reject,
        cleanup: () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
        },
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.queue.push(job);
      this.drain();
    });
  }
  private drain() {
    for (const slot of this.slots) {
      if (!slot.ready || slot.retired || slot.job || !this.queue.length) continue;
      slot.job = this.queue.shift()!;
      slot.worker.postMessage(slot.job.request);
    }
  }
  private retire(slot: Slot, error: FormaError, replace: boolean) {
    if (slot.retired) return;
    slot.retired = true;
    clearTimeout(slot.startupTimer);
    this.slots = this.slots.filter(s => s !== slot);
    if (slot.job) {
      slot.job.cleanup();
      slot.job.reject(error);
      slot.job = undefined;
    }
    // Wait for termination before replacement so timed-out jobs cannot keep
    // consuming CPU while new requests are admitted to a fresh worker.
    void slot.worker.terminate().then(async () => {
      if (replace && !this.closed) {
        try {
          await this.spawn();
        } catch (error) {
          log(this.config, 'error', 'Worker replacement failed', { error: String(error) });
        }
      }
    });
  }
  async close() {
    this.closed = true;
    const error = new FormaError('UNAVAILABLE', 'Renderer is shutting down', 503);
    for (const job of this.queue.splice(0)) {
      job.cleanup();
      job.reject(error);
    }
    const slots = this.slots.splice(0);
    await Promise.all(
      slots.map(slot => {
        slot.retired = true;
        clearTimeout(slot.startupTimer);
        if (slot.job) {
          slot.job.cleanup();
          slot.job.reject(error);
        }
        return slot.worker.terminate();
      }),
    );
  }
}
