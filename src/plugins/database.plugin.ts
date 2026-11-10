import fp from "fastify-plugin";
import { type FastifyPluginAsync } from "fastify";
import { DataSource } from "typeorm";
import { createDataSource } from "../config/database.js";

declare module "fastify" {
  interface FastifyInstance {
    db: DataSource;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  try {
    const connection = await createDataSource(fastify.config).initialize();
    
    fastify.decorate("db", connection);
    fastify.log.info("Success - connecting to the database");
    
    fastify.addHook("onClose", async (instance) => {
      await instance.db.destroy?.();
      fastify.log.info("Success - closing the database connection.");
    });
  } catch (error) {
    fastify.log.error({ err: error }, "Error - connecting to the database");
    throw error;
  }
};

export default fp(dbPlugin, {
  name: "fastify-database",
  dependencies: ["@fastify/env"],
});
