import type { AppConfig } from "./env.js";

const redisConfig = (config: AppConfig) => ({
  url: config.REDIS_URL,
  connectTimeout: config.REDIS_CONNECT_TIMEOUT,
  commandTimeout: config.REDIS_COMMAND_TIMEOUT,
  maxRetriesPerRequest: config.REDIS_MAX_RETRIES_PER_REQUEST,
  enableOfflineQueue: config.REDIS_ENABLE_OFFLINE_QUEUE,
});

export default redisConfig;