import assert from "node:assert/strict";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { setImmediate, setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import fastify from "fastify";
import fp from "fastify-plugin";
import "reflect-metadata";

const buildDir = process.env.TEST_BUILD_DIR ?? "dist";
const { AnalyticsService } = await import(
  pathToFileURL(resolve(buildDir, "modules/analytics/analytics.service.js")).href
);
const { AnalyticsQueue } = await import(
  pathToFileURL(resolve(buildDir, "modules/analytics/analytics-queue.js")).href
);
const { createUrlController } = await import(
  pathToFileURL(resolve(buildDir, "modules/urls/url.controller.js")).href
);
const { default: bullMqPlugin } = await import(
  pathToFileURL(resolve(buildDir, "plugins/bullmq.plugin.js")).href
);

async function createApp(queue, isQueueReady) {
  const logs = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of chunk.toString().trim().split("\n")) {
        logs.push(JSON.parse(line));
      }
      callback();
    },
  });
  const app = fastify({ logger: { stream } });
  app.decorate("db", { getRepository: () => ({}) });
  app.decorate("redis", { get: async () => "https://example.com" });
  app.decorate("config", { BASE_URL: "https://short.example", CACHE_TTL_SECONDS: 86400 });
  app.decorate("analytics", new AnalyticsService(() => isQueueReady() ? queue : undefined, app.log));
  app.register(createUrlController);
  await app.ready();
  return { app, logs };
}

test("redirects without waiting for analytics to be enqueued", async (t) => {
  let resolveEnqueue;
  const calls = [];
  const queue = {
    add(name, data, options) {
      calls.push({ name, data, options });
      return new Promise((resolve) => { resolveEnqueue = resolve; });
    },
  };
  const { app } = await createApp(queue, () => true);
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/abc" });
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://example.com");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "click_event");
  assert.equal(calls[0].data.url_code, "abc");
  assert.equal(calls[0].options.attempts, 3);
  assert.deepEqual(calls[0].options.removeOnComplete, { age: 86400, count: 10000 });
  assert.deepEqual(calls[0].options.removeOnFail, { age: 604800, count: 5000 });
  resolveEnqueue();
});

test("logs enqueue failures without affecting redirects", async (t) => {
  const queue = {
    async add() { throw new Error("Redis unavailable"); },
  };
  const { app, logs } = await createApp(queue, () => true);
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/abc" });
  await setImmediate();
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://example.com");
  assert.equal(logs.filter((entry) => entry.event === "analytics_enqueue_failed").length, 1);
});

test("skips enqueueing while unavailable and resumes after recovery", async (t) => {
  let ready = false;
  let calls = 0;
  const queue = {
    async add() { calls++; },
  };
  const { app, logs } = await createApp(queue, () => ready);
  t.after(() => app.close());

  const first = await app.inject({ method: "GET", url: "/abc" });
  assert.equal(first.statusCode, 302);
  assert.equal(calls, 0);
  assert.equal(logs.filter((entry) => entry.event === "analytics_enqueue_failed").length, 1);

  ready = true;
  const second = await app.inject({ method: "GET", url: "/abc" });
  assert.equal(second.statusCode, 302);
  assert.equal(calls, 1);
});

test("queue plugin reports unavailable Redis and closes", async () => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

  const logs = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of chunk.toString().trim().split("\n")) {
        logs.push(JSON.parse(line));
      }
      callback();
    },
  });
  const app = fastify({ logger: { stream } });
  app.register(fp(async (instance) => {
    instance.decorate("config", { REDIS_URL: `redis://127.0.0.1:${port}` });
  }, { name: "@fastify/env" }));
  app.register(bullMqPlugin);
  await app.ready();
  try {
    await app.analytics.trackClick({ url_code: "abc", ip: "127.0.0.1", userAgent: {} });
    assert.equal(logs.filter((entry) => entry.event === "analytics_enqueue_failed").length, 1);
  } finally {
    await app.close();
  }
});

test("recreates a queue after initialization fails and stops retries on close", async () => {
  const errors = [];
  const queues = [];
  let connectionReady = true;
  const manager = new AnalyticsQueue(() => {
    const first = queues.length === 0;
    const queue = {
      closed: 0,
      on() {},
      async waitUntilReady() {
        if (first) throw new Error("initialization failed");
      },
      async close() { this.closed++; },
    };
    queues.push(queue);
    return queue;
  }, () => connectionReady, { error: (...args) => errors.push(args) }, 5);

  try {
    const deadline = Date.now() + 2000;
    while (!manager.getReadyQueue() && Date.now() < deadline) await setTimeout(5);
    assert.equal(queues.length, 2);
    assert.equal(queues[0].closed, 1);
    assert.equal(manager.getReadyQueue(), queues[1]);
    assert.equal(errors.length, 1);
    connectionReady = false;
    assert.equal(manager.getReadyQueue(), undefined);
    connectionReady = true;
    assert.equal(manager.getReadyQueue(), queues[1]);
  } finally {
    await manager.close();
  }
  assert.equal(queues[1].closed, 1);
  await setTimeout(15);
  assert.equal(queues.length, 2);
});

test("closing while a retry is pending prevents queue recreation", async () => {
  let creations = 0;
  const manager = new AnalyticsQueue(() => {
    creations++;
    return {
      on() {},
      async waitUntilReady() { throw new Error("initialization failed"); },
      async close() {},
    };
  }, () => true, { error() {} }, 25);
  await setImmediate();
  await manager.close();
  await setTimeout(50);
  assert.equal(creations, 1);
});
