import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import redisConfig from "../config/redis.js";
import type { FastifyPluginAsync } from "fastify";

const BullMqPlugin: FastifyPluginAsync = async (fastify) => {
  const baseConfig = redisConfig(fastify.config);
  const connection = new Redis(baseConfig.url, {
    maxRetriesPerRequest: 5,
  });

  const analyticsQueue = new Queue("url-analytics", {
    connection,
  });

  fastify.decorate("queue", analyticsQueue);

  fastify.addHook("onClose", async () => {
    await analyticsQueue.close();
    await connection.quit();
  });
};

export default fp(BullMqPlugin, {
  name: "fastify-bullmq",
  dependencies: ["@fastify/env"],
});
