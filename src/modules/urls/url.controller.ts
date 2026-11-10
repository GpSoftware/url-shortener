import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
import { UrlRepository } from "./url.repository.js";
import { UrlService } from "./url.service.js";

export async function createUrlController(fastify: FastifyInstance) {
  const urlRepository = new UrlRepository(fastify.db);
  const urlService = new UrlService(urlRepository, fastify.redis);

  fastify.post("/shorten", async (req: FastifyRequest, reply: FastifyReply) => {
    const { url } = req.body as { url: string };
    const newUrl = await urlService.generateShortUrl(url);
    reply.send(newUrl);
  });

  fastify.get("/:shortUrl", async (req: FastifyRequest, reply: FastifyReply) => {
    const { shortUrl } = req.params as { shortUrl: string };
    const url = await urlService.findByShortUrl(shortUrl);
    await urlService.registerClick(shortUrl, req.ip, req.headers["user-agent"] ? { "user-agent": req.headers["user-agent"] } : {});
    reply.redirect(url);
  });
}
