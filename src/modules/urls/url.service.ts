import { UrlRepository } from "./url.repository.js";
import isValidUrl from "../../utils/validate-url.util.js";
import { RedisService } from "../../shared/redis.service.js";
import type { AnalyticsService } from "../analytics/analytics.service.js";
import { AppError } from "../../shared/app.error.js";

export class UrlService {
  constructor(
    private urlRepository: UrlRepository,
    private redisService: RedisService,
    private analyticsService: AnalyticsService,
    private baseUrl: string,
  ) {}

  async generateShortUrl(url: string) {
    if (!isValidUrl(url)) {
      throw new AppError("Invalid URL", 400);
    }

    const newUrl = await this.urlRepository.generateShortUrl(url);
    const shortUrl = `${this.baseUrl.replace(/\/+$/, "")}/${newUrl.url_code}`;

    await this.redisService.set(newUrl.url_code, newUrl.original_url);

    return shortUrl;
  }

  async findByShortUrl(shortUrl: string) {
    const cached = await this.redisService.get(shortUrl);

    if (cached.ok && cached.value !== null) {
      return cached.value;
    }

    const url = await this.urlRepository.findByShortUrl(shortUrl);

    if (cached.ok) {
      await this.redisService.set(shortUrl, url.original_url);
    }

    return url.original_url;
  }

  async deleteByShortUrl(shortUrl: string) {
    return this.urlRepository.deleteByShortUrl(shortUrl);
  }

  registerClick(url_code: string, ip: string, userAgent: Record<string, string>) {
    // For billing or critical metrics, use a durable outbox despite its complexity and added latency.
    void this.analyticsService.trackClick({ url_code, ip, userAgent });
  }
}
