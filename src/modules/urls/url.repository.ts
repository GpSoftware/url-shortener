import { DataSource, Repository } from "typeorm";
import { UrlEntity } from "./url.entity.js";
import generateCode from "../../utils/code-generator.util.js";

export class UrlRepository {
  private repository: Repository<UrlEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(UrlEntity);
  }

  async generateShortUrl(url: string) {
    const code = generateCode();
    const newUrl = this.repository.create({
      original_url: url,
      url_code: code,
    });
    return this.repository.save(newUrl);
  }

  async findByShortUrl(shortUrl: string) {
    return this.repository.findOneOrFail({ where: { url_code: shortUrl } });
  }

  async deleteByShortUrl(shortUrl: string) {
    return this.repository.delete({ url_code: shortUrl });
  }
}
