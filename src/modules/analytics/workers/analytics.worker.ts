import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { DataSource } from "typeorm";
import { AnalyticsEntity } from "../analytics.entity.js";
import { UrlEntity } from "../../urls/url.entity.js";

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
console.log("📦 [Worker] Connection established");

export const redisConnection = new Redis(
  process.env["REDIS_URL"] || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null },
);

console.log("⏳ [Worker] Initializing...");

const worker = new Worker(
  'url-analytics',
  async (job) => {
    const { url_code, ip, userAgent } = job.data;

    console.log(`🤖 [Worker] Processing analytics with id: ${url_code}`);

    const analyticsRepository = WorkerDataSource.getRepository(AnalyticsEntity);
    const urlRepository = WorkerDataSource.getRepository(UrlEntity);
    
    const url = await urlRepository.findOneBy({ url_code });
    if (!url) {
      throw new Error(`URL with code ${url_code} not found`);
    }
    
    const click = analyticsRepository.create({
      url: url,
      ip_address: ip,
      user_agent_details: userAgent,
    });

    await analyticsRepository.save(click);
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