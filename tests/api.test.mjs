import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import fastify from "fastify";
import { EntityNotFoundError } from "typeorm";
import "reflect-metadata";

const buildDir = process.env.TEST_BUILD_DIR ?? "dist";
const { registerHttpRoutes } = await import(pathToFileURL(resolve(buildDir, "app.js")).href);
const { UrlEntity } = await import(pathToFileURL(resolve(buildDir, "modules/urls/url.entity.js")).href);
const { AppError } = await import(pathToFileURL(resolve(buildDir, "shared/app.error.js")).href);

async function createApp(baseUrl = "https://short.example/") {
  const data = new Map();
  const cache = new Map();
  const writes = [];
  const clicks = [];
  const state = { redisDown: false, redisSlow: false, dbDown: false, failSet: false };
  const repository = {
    create(value) { return value; },
    async save(value) {
      if (state.dbDown) throw new Error("database down");
      data.set(value.url_code, value.original_url);
      return value;
    },
    async findOneOrFail({ where }) {
      if (state.dbDown) throw new Error("database down");
      const original_url = data.get(where.url_code);
      if (!original_url) throw new EntityNotFoundError(UrlEntity, where);
      return { url_code: where.url_code, original_url };
    },
  };
  const app = fastify({ ajv: { customOptions: { coerceTypes: false } } });
  app.decorate("config", { BASE_URL: baseUrl, CACHE_TTL_SECONDS: 7 });
  app.decorate("db", {
    getRepository: () => repository,
    async query() {
      if (state.dbDown) throw new Error("database down");
      return [{ "?column?": 1 }];
    },
  });
  app.decorate("redis", {
    async get(key) {
      if (state.redisDown) throw new Error("redis down");
      if (state.redisSlow) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 20));
        throw new Error("Redis command timed out");
      }
      return cache.get(key) ?? null;
    },
    async set(key, value, mode, ttl) {
      writes.push({ key, value, mode, ttl });
      if (state.failSet) throw new Error("redis write failed");
      cache.set(key, value);
      return "OK";
    },
  });
  app.decorate("analytics", {
    async trackClick(data) { clicks.push(data); },
  });
  registerHttpRoutes(app);
  app.get("/internal-test", async () => { throw new AppError("private detail", 503); });
  await app.ready();
  return { app, data, cache, writes, clicks, state };
}

test("rejects an invalid public base URL at startup", async () => {
  await assert.rejects(createApp("ftp://short.example/"), /BASE_URL/);
  await assert.rejects(createApp("https://short.example/?token=value"), /BASE_URL/);
});

test("validates request bodies and creates a URL using validated configuration", async (t) => {
  const { app, writes } = await createApp();
  t.after(() => app.close());

  for (const payload of [null, {}, { url: "" }, { url: 123 }, { url: "ftp://example.com" }]) {
    const response = await app.inject({ method: "POST", url: "/shorten", payload });
    assert.equal(response.statusCode, 400, JSON.stringify(payload));
  }
  const malformed = await app.inject({
    method: "POST",
    url: "/shorten",
    headers: { "content-type": "application/json" },
    payload: "{",
  });
  assert.equal(malformed.statusCode, 400);

  const response = await app.inject({
    method: "POST",
    url: "/shorten",
    payload: { url: "https://example.com/path" },
  });
  assert.equal(response.statusCode, 200);
  const shortUrl = response.body;
  assert.match(shortUrl, /^https:\/\/short\.example\/[a-zA-Z0-9]{10}$/);
  assert.deepEqual(writes[0], {
    key: shortUrl.split("/").pop(),
    value: "https://example.com/path",
    mode: "EX",
    ttl: 7,
  });
});

test("redirects on cache hit, miss and Redis failure", async (t) => {
  const { app, data, cache, writes, clicks, state } = await createApp();
  t.after(() => app.close());
  data.set("hit", "https://example.com/hit");
  cache.set("hit", "https://example.com/hit");
  data.set("cold", "https://example.com/cold");
  data.set("offline", "https://example.com/offline");
  data.set("write-error", "https://example.com/write-error");

  for (const [code, destination] of [
    ["hit", "https://example.com/hit"],
    ["cold", "https://example.com/cold"],
  ]) {
    const response = await app.inject({ method: "GET", url: `/${code}` });
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, destination);
  }
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ttl, 7);
  assert.equal(cache.get("cold"), "https://example.com/cold");

  state.redisDown = true;
  let response = await app.inject({ method: "GET", url: "/offline" });
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://example.com/offline");
  assert.equal(writes.length, 1);

  state.redisDown = false;
  state.failSet = true;
  response = await app.inject({ method: "GET", url: "/write-error" });
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://example.com/write-error");
  assert.equal(clicks.length, 4);
});

test("URL creation succeeds if populating Redis fails", async (t) => {
  const { app, state, data } = await createApp();
  t.after(() => app.close());
  state.failSet = true;
  const response = await app.inject({
    method: "POST",
    url: "/shorten",
    payload: { url: "https://example.com" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(data.get(response.body.split("/").pop()), "https://example.com");
});

test("falls back to the database when a slow cache command times out", async (t) => {
  const { app, data, writes, state } = await createApp();
  t.after(() => app.close());
  data.set("slow", "https://example.com/slow");
  state.redisSlow = true;
  const response = await app.inject({ method: "GET", url: "/slow" });
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://example.com/slow");
  assert.equal(writes.length, 0);
});

test("returns 404 and 500 without leaking database errors", async (t) => {
  const { app, state } = await createApp();
  t.after(() => app.close());

  let response = await app.inject({ method: "GET", url: "/missing" });
  assert.equal(response.statusCode, 404);
  state.dbDown = true;
  response = await app.inject({ method: "GET", url: "/missing" });
  assert.equal(response.statusCode, 500);
  assert.doesNotMatch(response.body, /database down/);
  response = await app.inject({ method: "GET", url: "/internal-test" });
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /private detail/);
});

test("liveness remains available when readiness detects a database failure", async (t) => {
  const { app, state } = await createApp();
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: "/ready" })).statusCode, 200);
  state.dbDown = true;
  assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: "/ready" })).statusCode, 503);
});
