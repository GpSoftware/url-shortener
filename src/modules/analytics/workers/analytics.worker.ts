import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { DataSource } from "typeorm";
import { AnalyticsEntity } from "../analytics.entity.js";
import { UrlEntity } from "../../urls/url.entity.js";
import { persistClick } from "../analytics.persistence.js";
import type { AnalyticsJobData } from "../analytics.service.js";
import { UrlRepository } from "../../urls/url.repository.js";
import { UrlLookupService } from "../../urls/url-lookup.service.js";

const WorkerDataSource = new DataSource({
  type: "postgres",
  host: process.env["DB_HOST"]!,
  port: parseInt(process.env["DB_PORT"] || "5432", 10),
  username: process.env["DB_USER"]!,
  password: process.env["DB_PASSWORD"]!,
  database: process.env["DB_NAME"]!,
  synchronize: process.env["DB_SYNCHRONIZE"] === "true",
  logging: false,
  entities: [UrlEntity, AnalyticsEntity],
  migrations: [],
  subscribers: [],
});

await WorkerDataSource.initialize();
const urlLookup = new UrlLookupService(new UrlRepository(WorkerDataSource));
console.log("📦 [Worker] Connection established");

export const redisConnection = new Redis(
  process.env["REDIS_URL"] || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null },
);

console.log("⏳ [Worker] Initializing...");

const worker = new Worker<AnalyticsJobData>(
  'url-analytics',
  async (job) => {
    await persistClick(WorkerDataSource, urlLookup, job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on("error", (error) => {
  console.error("❌ [Worker] BullMQ error:", error);
});

await worker.waitUntilReady();
console.log("✅ [Worker] Ready and waiting for analytics jobs");