import type { DataSource } from "typeorm";
import { AnalyticsEntity } from "./analytics.entity.js";
import type { AnalyticsJobData } from "./analytics.service.js";
import type { UrlLookupService } from "../urls/url-lookup.service.js";

export async function persistClick(
  dataSource: DataSource,
  urlLookup: Pick<UrlLookupService, "findIdByShortUrl">,
  data: AnalyticsJobData,
) {
  const urlId = await urlLookup.findIdByShortUrl(data.url_code);
  if (!urlId) throw new Error(`URL with code ${data.url_code} not found`);

  await dataSource.getRepository(AnalyticsEntity).insert({
    url: { id: urlId },
    ip_address: data.ip,
    user_agent_details: data.userAgent,
  });
}
