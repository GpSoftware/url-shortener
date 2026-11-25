import "reflect-metadata";
import fastify from "fastify";
import fastifyEnv from "@fastify/env";
import fastifyRedis from "@fastify/redis";
import envsOptions from "./config/env.js";
import redisConfig from "./config/redis.js";
import dbPlugin from "./plugins/database.plugin.js";
import bullMqPlugin from "./plugins/bullmq.plugin.js";
import { EntityNotFoundError } from "typeorm";
import { AppError } from "./shared/app.error.js";
import isClientError from "./utils/is-client-error.js";

import { createUrlController } from "./modules/urls/url.controller.js";

export default function buildApp(options = {}) {
  const app = fastify(options);

  app.register(fastifyEnv, envsOptions);

  app.register(dbPlugin);
  app.register(fastifyRedis, (instance) => redisConfig(instance.config));
  app.register(bullMqPlugin);

  app.register(createUrlController);

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof EntityNotFoundError) {
      return reply.status(404).send({
        message: "Recurso no encontrado",
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
      });
    }

    if (isClientError(error)) {
      return reply.status(error.statusCode).send({
        message: error.message,
      });
    }

    request.log.error({ err: error }, "Error processing request");

    return reply.status(500).send({
      message: "Server Internal Error",
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
