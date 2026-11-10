import { DataSource } from "typeorm";
import { UrlEntity } from "../modules/urls/url.entity.js";
import type { AppConfig } from "./env.js";
import { AnalyticsEntity } from "../modules/analytics/analytics.entity.js";

export const createDataSource = (config: AppConfig) => new DataSource({
  type: "postgres",
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  synchronize: config.DB_SYNCHRONIZE,
  logging: false,
  entities: [UrlEntity, AnalyticsEntity],
  migrations: [],
  subscribers: [],
});
