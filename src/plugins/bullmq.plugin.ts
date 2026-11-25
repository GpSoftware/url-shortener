import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import redisConfig from "../config/redis.js";
import type { FastifyPluginAsync } from "fastify";
import { AnalyticsService, type AnalyticsJobData } from "../modules/analytics/analytics.service.js";
import { AnalyticsQueue } from "../modules/analytics/analytics-queue.js";

declare module "fastify" {
  interface FastifyInstance {
    analytics: AnalyticsService;
  }
}

const BullMqPlugin: FastifyPluginAsync = async (fastify) => {
  const baseConfig = redisConfig(fastify.config);
  const connection = new Redis(baseConfig.url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 1000,
  });

  const analyticsQueue = new AnalyticsQueue(
    () => new Queue<AnalyticsJobData>("url-analytics", { connection }),
    () => connection.status === "ready",
    fastify.log,
  );

  fastify.decorate("analytics", new AnalyticsService(
    () => analyticsQueue.getReadyQueue(),
    fastify.log,
  ));

  fastify.addHook("onClose", async () => {
    await analyticsQueue.close();
    if (connection.status === "ready") {
      await connection.quit();
    } else {
      connection.disconnect();
    }
  });
};

export default fp(BullMqPlugin, {
  name: "fastify-bullmq",
  dependencies: ["@fastify/env"],
});
