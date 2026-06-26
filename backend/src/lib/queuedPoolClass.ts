/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, QueryResult } from 'pg';

interface QueuedQuery {
  text: string;
  params?: any[];
  resolve: (value: QueryResult | PromiseLike<QueryResult>) => void;
  reject: (reason?: any) => void;
}

interface QueuedPoolOptions {
  maxQueueSize?: number;
  queueTimeout?: number;
}

export class QueuedPool {
  private pool: Pool;
  private maxQueueSize: number;
  private queueTimeout: number;
  private queue: QueuedQuery[];
  private processing: boolean = false;

  constructor(pool: Pool, options: QueuedPoolOptions = {}) {
    this.pool = pool;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.queueTimeout = options.queueTimeout || 30000;
    this.queue = [];
  }

  /**
   * Enqueues a query statement and enforces backpressure thresholds
   */
  public async query(text: string, params?: any[]): Promise<QueryResult> {
    // 1. Enforce strict backpressure ceiling
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Query queue full - application layer backpressure applied');
    }

    return new Promise<QueryResult>((resolve, reject) => {
      // 2. Set up queue timeout guard
      const timeout = setTimeout(() => {
        const index = this.queue.findIndex(q => q.resolve === resolve);
        if (index > -1) {
          this.queue.splice(index, 1);
          reject(new Error('Query timed out waiting inside application memory queue'));
        }
      }, this.queueTimeout);

      // 3. Inject task into task loop
      this.queue.push({
        text,
        params,
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // 4. Trigger safe sequential processing
      this.processQueue();
    });
  }

  /**
   * Safe sequential task execution loop draining the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Monitor underlying pg driver metrics for pool health state
      // pool.waitingCount: requests queued waiting for a free slot
      if (this.pool.waitingCount > this.pool.totalCount) {
        // Pool is choked. Yield thread execution briefly to allow hardware sockets to clear
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const task = this.queue.shift();
      if (!task) continue;

      const { text, params, resolve, reject } = task;

      try {
        const result = await this.pool.query(text, params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}