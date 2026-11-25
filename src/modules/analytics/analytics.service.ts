import type { Queue } from "bullmq";
import type { FastifyBaseLogger } from "fastify";

export interface AnalyticsJobData {
  url_code: string;
  ip: string;
  userAgent: Record<string, string>;
}

export class AnalyticsService {
  constructor(
    private readonly getQueue: () => Queue<AnalyticsJobData> | undefined,
    private readonly log: FastifyBaseLogger,
  ) {}

  async trackClick(data: AnalyticsJobData) {
    const queue = this.getQueue();
    if (!queue) {
      this.log.error({ event: "analytics_enqueue_failed" }, "Analytics queue is not ready");
      return;
    }

    try {
      await queue.add("click_event", data, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 5000 },
      });
    } catch (error) {
      this.log.error({ err: error, event: "analytics_enqueue_failed" }, "Failed to enqueue analytics");
    }
  }
}