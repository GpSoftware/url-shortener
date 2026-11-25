import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const buildDir = process.env.TEST_BUILD_DIR ?? "dist";
const { createFixture } = await import(
  pathToFileURL(resolve(buildDir, "scripts/load-fixture.js")).href
);

test("cold fixtures delete only the newly created cached URL", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://api/shorten");
    assert.equal(JSON.parse(options.body).url, "https://example.com/load-test");
    return new Response("http://public/Abc1234567", { status: 200 });
  });
  const deleted = [];
  const redis = {
    async get(key) {
      assert.equal(key, "Abc1234567");
      return "https://example.com/load-test";
    },
    async ttl() { return 600; },
    async del(key) { deleted.push(key); return 1; },
  };
  assert.deepEqual(await createFixture("http://api", redis, "cold"), {
    code: "Abc1234567",
    destination: "https://example.com/load-test",
    ttlSeconds: 600,
  });
  assert.deepEqual(deleted, ["Abc1234567"]);
  await createFixture("http://api", redis, "warm");
  assert.deepEqual(deleted, ["Abc1234567"]);
});

test("fixtures fail explicitly if the cache cannot be verified or cleared", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response("http://public/Abc1234567", { status: 200 }));
  await assert.rejects(
    createFixture("http://api", { get: async () => null, ttl: async () => 1, del: async () => 1 }, "warm"),
    /not cached/,
  );
  await assert.rejects(
    createFixture("http://api", {
      get: async () => "https://example.com/load-test",
      ttl: async () => 5,
      del: async () => 0,
    }, "cold"),
    /remove fixture/,
  );
  await assert.rejects(
    createFixture("http://api", {
      get: async () => "https://example.com/load-test",
      ttl: async () => -1,
      del: async () => 1,
    }, "warm"),
    /TTL/,
  );
});

test("fixtures reject failed API responses and malformed codes", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    new Response("failed", { status: 500 }));
  const redis = { get: async () => null, ttl: async () => 1, del: async () => 1 };
  await assert.rejects(createFixture("http://api", redis, "warm"), /HTTP 500/);
  fetchMock.mock.mockImplementation(async () => new Response("http://public/invalid", { status: 200 }));
  await assert.rejects(createFixture("http://api", redis, "cold"), /Invalid fixture code/);
});
