import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { Redis } from "ioredis";

const destination = "https://example.com/load-test";

export async function createFixture(
  apiUrl: string,
  redis: Pick<Redis, "get" | "del" | "ttl">,
  mode: "warm" | "cold",
) {
  const response = await fetch(`${apiUrl}/shorten`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: destination }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Fixture creation failed: HTTP ${response.status}`);

  const shortUrl = new URL(await response.text());
  const code = shortUrl.pathname.split("/").pop();
  if (!code || !/^[a-zA-Z0-9]{10}$/.test(code)) throw new Error("Invalid fixture code");
  if (await redis.get(code) !== destination) throw new Error("Fixture is not cached");
  const ttlSeconds = await redis.ttl(code);
  if (ttlSeconds <= 0) throw new Error("Fixture has no usable cache TTL");
  if (mode === "cold" && await redis.del(code) !== 1) {
    throw new Error("Failed to remove fixture from cache");
  }
  return { code, destination, ttlSeconds };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const redis = new Redis(process.env["REDIS_URL"] || "redis://127.0.0.1:6379", {
    enableOfflineQueue: false,
    commandTimeout: 1000,
  });
  const apiUrl = process.env["API_URL"] || "http://127.0.0.1:3000";
  const server = createServer(async (request, reply) => {
    if (request.method === "GET" && request.url === "/health") {
      reply.writeHead(200).end();
      return;
    }
    if (request.method !== "GET" || (request.url !== "/warm" && request.url !== "/cold")) {
      reply.writeHead(404).end();
      return;
    }
    try {
      const fixture = await createFixture(apiUrl, redis, request.url === "/warm" ? "warm" : "cold");
      reply.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(fixture));
    } catch (error) {
      console.error("Failed to prepare load-test fixture", error);
      reply.writeHead(503).end("Failed to prepare fixture");
    }
  });
  server.listen(3001, "0.0.0.0");
}
