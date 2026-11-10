import type { AppConfig } from "./env.js";

const redisConfig = (config: AppConfig) => ({
  url: config.REDIS_URL,
});

export default redisConfig;