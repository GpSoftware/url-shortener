import { UrlRepository } from "./url.repository.js";

export class UrlLookupService {
  constructor(private readonly urlRepository: UrlRepository) {}

  findIdByShortUrl(shortUrl: string) {
    return this.urlRepository.findIdByShortUrl(shortUrl);
  }
}
