import assert from "node:assert/strict";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

const buildDir = process.env.TEST_BUILD_DIR ?? "dist";
const { AnalyticsQueue } = await import(
  pathToFileURL(resolve(buildDir, "modules/analytics/analytics-queue.js")).href
);

test("recreates a real BullMQ queue after a Redis initialization error", { timeout: 5000 }, async () => {
  let infoCalls = 0;
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.setTimeout(4000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        const header = buffer.indexOf("\r\n");
        if (header < 0) return;
        const count = Number(buffer.subarray(1, header).toString());
        let offset = header + 2;
        const args = [];
        for (let i = 0; i < count; i++) {
          const end = buffer.indexOf("\r\n", offset);
          if (end < 0) return;
          const size = Number(buffer.subarray(offset + 1, end).toString());
          if (buffer.length < end + 2 + size + 2) return;
          args.push(buffer.subarray(end + 2, end + 2 + size).toString());
          offset = end + 2 + size + 2;
        }
        buffer = buffer.subarray(offset);
        const command = args[0].toLowerCase();
        if (command === "info") {
          infoCalls++;
          if (infoCalls === 1) {
            socket.write("-ERR temporary initialization failure\r\n");
          } else {
            const info = "redis_version:7.0.0\r\n";
            socket.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`);
          }
        } else if (command === "quit") {
          socket.end("+OK\r\n");
        } else if (command === "evalsha" || command === "eval") {
          socket.write("$1\r\n1\r\n");
        } else {
          socket.write("+OK\r\n");
        }
      }
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const redis = new Redis(server.address().port, "127.0.0.1", {
    enableReadyCheck: false,
    enableOfflineQueue: false,
    commandTimeout: 1000,
  });
  redis.on("error", () => {});
  const errors = [];
  const manager = new AnalyticsQueue(
    () => new Queue("test-analytics", { connection: redis, skipMetasUpdate: true }),
    () => redis.status === "ready",
    { error: (...args) => errors.push(args) },
    5,
  );
  try {
    const deadline = Date.now() + 3000;
    while (!manager.getReadyQueue() && Date.now() < deadline) await setTimeout(10);
    const queue = manager.getReadyQueue();
    assert.ok(queue, "queue did not recover");
    assert.equal(infoCalls, 2);
    assert.ok(errors.length > 0);
    const job = await queue.add("click_event", { url_code: "abc" });
    assert.equal(job.id, "1");
  } finally {
    await manager.close();
    if (redis.status === "ready") await redis.quit();
    else redis.disconnect();
    await new Promise((resolveClose, reject) =>
      server.close((error) => error ? reject(error) : resolveClose()));
  }
});
