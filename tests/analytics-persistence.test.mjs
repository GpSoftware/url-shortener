import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import "reflect-metadata";

const buildDir = process.env.TEST_BUILD_DIR ?? "dist";
const { persistClick } = await import(
  pathToFileURL(resolve(buildDir, "modules/analytics/analytics.persistence.js")).href
);
const { UrlEntity } = await import(
  pathToFileURL(resolve(buildDir, "modules/urls/url.entity.js")).href
);
const { AnalyticsEntity } = await import(
  pathToFileURL(resolve(buildDir, "modules/analytics/analytics.entity.js")).href
);
const { UrlRepository } = await import(
  pathToFileURL(resolve(buildDir, "modules/urls/url.repository.js")).href
);
const { UrlLookupService } = await import(
  pathToFileURL(resolve(buildDir, "modules/urls/url-lookup.service.js")).href
);

test("persists a click using only the URL id", async () => {
  const data = { url_code: "abc", ip: "127.0.0.1", userAgent: { "user-agent": "test" } };
  let inserted;
  const urlDb = {
    getRepository(entity) {
      assert.equal(entity, UrlEntity);
      return {
        async findOne(options) {
          assert.deepEqual(options, { select: { id: true }, where: { url_code: "abc" } });
          return { id: "url-id" };
        },
      };
    },
  };
  const db = {
    getRepository(entity) {
      assert.equal(entity, AnalyticsEntity);
      return { async insert(value) { inserted = value; } };
    },
  };
  await persistClick(db, new UrlLookupService(new UrlRepository(urlDb)), data);
  assert.deepEqual(inserted, {
    url: { id: "url-id" },
    ip_address: "127.0.0.1",
    user_agent_details: { "user-agent": "test" },
  });
});

test("does not insert analytics if the URL is missing", async () => {
  let inserts = 0;
  const db = {
    getRepository() {
      return { async insert() { inserts++; } };
    },
  };
  const urlDb = { getRepository: () => ({ async findOne() { return null; } }) };
  await assert.rejects(
    persistClick(db, new UrlLookupService(new UrlRepository(urlDb)), {
      url_code: "missing", ip: "127.0.0.1", userAgent: {},
    }),
    /not found/,
  );
  assert.equal(inserts, 0);
});
