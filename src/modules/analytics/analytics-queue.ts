import type { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { AnalyticsJobData } from "./analytics.service.js";

export class AnalyticsQueue {
  private queue: Queue<AnalyticsJobData> | undefined;
  private ready = false;
  private closed = false;
  private retryTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly createQueue: () => Queue<AnalyticsJobData>,
    private readonly connectionReady: () => boolean,
    private readonly log: FastifyBaseLogger,
    private readonly retryDelay = 1000,
  ) {
    this.initialize();
  }

  getReadyQueue(): Queue<AnalyticsJobData> | undefined {
    return this.ready && this.connectionReady() ? this.queue : undefined;
  }

  async close() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    await this.queue?.close();
  }

  private initialize() {
    if (this.closed) return;

    const queue = this.createQueue();
    this.queue = queue;
    this.ready = false;
    queue.on("error", (error) => {
      this.log.error({ err: error }, "Analytics queue error");
    });
    void queue.waitUntilReady().then(
      () => {
        if (!this.closed && this.queue === queue) this.ready = true;
      },
      async (error: unknown) => {
        if (this.closed) return;
        this.log.error({ err: error }, "Analytics queue initialization failed");
        try {
          await queue.close();
        } catch (closeError) {
          this.log.error({ err: closeError }, "Failed to close analytics queue");
        }
        if (!this.closed) {
          this.retryTimer = setTimeout(() => this.initialize(), this.retryDelay);
        }
      },
    );
  }
}
