import type { FastifyInstance } from "fastify";

type CacheResult =
  | { ok: true; value: string | null }
  | { ok: false };

export class RedisService {
  constructor(
    private redis: FastifyInstance["redis"],
    private log: FastifyInstance["log"],
  ) {}

  async get(key: string): Promise<CacheResult> {
    try {
      return { ok: true, value: await this.redis.get(key) };
    } catch (error) {
      this.log.error({ err: error }, "Error reading Redis");
      return { ok: false };
    }
  }

  async set(key: string, value: string): Promise<boolean> {
    try {
      await this.redis.set(key, value);
      return true;
    } catch (error) {
      this.log.error({ err: error }, "Error writing Redis");
      return false;
    }
  }
}