import "reflect-metadata";
import fastify, { type FastifyInstance } from "fastify";
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
  const app = fastify({
    ...options,
    ajv: { customOptions: { coerceTypes: false } },
  });

  app.register(fastifyEnv, envsOptions);

  app.register(dbPlugin);
  app.register(fastifyRedis, (instance) => redisConfig(instance.config));
  app.register(bullMqPlugin);

  registerHttpRoutes(app);

  return app;
}

export function registerHttpRoutes(app: FastifyInstance) {
  app.register(createUrlController);
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof EntityNotFoundError) {
      return reply.status(404).send({
        message: "Recurso no encontrado",
      });
    }

    if (error instanceof AppError && Number.isInteger(error.statusCode)
      && error.statusCode >= 400 && error.statusCode < 500) {
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

    const statusCode = error instanceof AppError && Number.isInteger(error.statusCode)
      && error.statusCode >= 500 && error.statusCode <= 599 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      message: "Server Internal Error",
    });
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await app.db.query("SELECT 1");
      return { status: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      return reply.status(503).send({ status: "unavailable" });
    }
  });
}
