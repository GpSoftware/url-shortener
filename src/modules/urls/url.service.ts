import { UrlRepository } from "./url.repository.js";
import isValidUrl from "../../utils/validate-url.util.js";
import type { FastifyInstance } from "fastify";
import AnalyticsService from "../analytics/analytics.service.js";

export class UrlService {
  constructor(
    private urlRepository: UrlRepository,
    private redis: FastifyInstance["redis"],
  ) {}

  async generateShortUrl(url: string) {
    try {
      if (!isValidUrl(url)) {
        throw new Error("Invalid URL");
      }

      const newUrl = await this.urlRepository.generateShortUrl(url);
      const urlToRedirect = `${process.env["BASE_URL"]}/${newUrl.url_code}`;
      await this.redis.set(newUrl.url_code, newUrl.original_url);
      return urlToRedirect;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to generate short URL");
    }
  }

  async findByShortUrl(shortUrl: string) {
    try {
      const cachedUrl = await this.redis.get(shortUrl);
      if (cachedUrl) {
        return cachedUrl;
      }

      const url = await this.urlRepository.findByShortUrl(shortUrl);
      const urlToRedirect = `${process.env["BASE_URL"]}/${url.url_code}`;
      await this.redis.set(shortUrl, url.original_url);
      return urlToRedirect;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to find URL by short URL");
    }
  }

  async deleteByShortUrl(shortUrl: string) {
    return this.urlRepository.deleteByShortUrl(shortUrl);
  }

  async registerClick(url_code: string, ip: string, userAgent: Record<string, any>) {
    await AnalyticsService.trackClick({ url_code, ip, userAgent });
  }
}
