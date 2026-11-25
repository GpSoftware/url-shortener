import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
import { UrlRepository } from "./url.repository.js";
import { UrlService } from "./url.service.js";
import { RedisService } from "../../shared/redis.service.js";
import type { CreateUrlDto } from "./url.type.js";
import schemas from "./url.schema.js";

export async function createUrlController(fastify: FastifyInstance) {
  const baseUrl = new URL(fastify.config.BASE_URL);
  if ((baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") || baseUrl.search || baseUrl.hash) {
    throw new Error("BASE_URL must be an HTTP(S) URL without a query or fragment");
  }
  const urlRepository = new UrlRepository(fastify.db);
  const redisService = new RedisService(fastify.redis, fastify.log, fastify.config.CACHE_TTL_SECONDS);
  const urlService = new UrlService(urlRepository, redisService, fastify.analytics, baseUrl.toString());

  fastify.post<CreateUrlDto>(
    "/shorten",
    schemas.createUrl,
    async (req, reply: FastifyReply) => {
      const { url } = req.body;
      const newUrl = await urlService.generateShortUrl(url);
      reply.send(newUrl);
    },
  );

  fastify.get(
    "/:shortUrl",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { shortUrl } = req.params as { shortUrl: string };
      const url = await urlService.findByShortUrl(shortUrl);
      urlService.registerClick(
        shortUrl,
        req.ip,
        req.headers["user-agent"]
          ? { "user-agent": req.headers["user-agent"] }
          : {},
      );
      reply.redirect(url);
    },
  );
}
