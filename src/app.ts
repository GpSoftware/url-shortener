import "reflect-metadata";
import fastify from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyRedis from "@fastify/redis";
import envsOptions from "./config/env.js";
import redisConfig from "./config/redis.js";
import dbPlugin from "./plugins/database.plugin.js";
import bullMqPlugin from "./plugins/bullmq.plugin.js";

import { createUrlController } from "./modules/urls/url.controller.js";

export default function buildApp(options = {}) {
  const app = fastify(options);

  app.register(fastifyEnv, envsOptions);

  app.register(dbPlugin);
  app.register(fastifyRedis, (instance) => redisConfig(instance.config));
  app.register(bullMqPlugin);

  app.register(createUrlController);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
