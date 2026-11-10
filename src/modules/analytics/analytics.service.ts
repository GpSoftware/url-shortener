import { Queue } from "bullmq";

interface AnalyticsJobData {
  url_code: string;
  ip: string;
  userAgent: Record<string, any>;
}

class AnalyticsService {
  private readonly analyticsQueue: Queue;

  constructor() {
    this.analyticsQueue = new Queue("url-analytics", {
      connection: {
        url: process.env["REDIS_URL"] || "redis://127.0.0.1:6379",
      },
    });
  }

  async trackClick(data: AnalyticsJobData) {
    await this.analyticsQueue.add("click_event", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
  }
}

export default new AnalyticsService();