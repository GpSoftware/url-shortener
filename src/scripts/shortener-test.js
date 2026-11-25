import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const FIXTURE_URL = __ENV.FIXTURE_URL || "http://localhost:3001";
const VUS = Number(__ENV.LOAD_VUS || 20);
const DURATION = __ENV.LOAD_DURATION || "1m";
const DESTINATION = "https://example.com/load-test";
const durationMatch = /^([1-9][0-9]*)(s|m|h)$/.exec(DURATION);
if (!Number.isInteger(VUS) || VUS < 1 || !durationMatch) {
  throw new Error("LOAD_VUS must be positive and LOAD_DURATION must use whole seconds, minutes or hours");
}
const durationSeconds = Number(durationMatch[1]) * { s: 1, m: 60, h: 3600 }[durationMatch[2]];

export const options = {
  scenarios: {
    create: { executor: "constant-vus", vus: VUS, duration: DURATION, exec: "create" },
    warm: { executor: "constant-vus", vus: VUS, duration: DURATION, exec: "warm" },
    cold: { executor: "constant-vus", vus: VUS, duration: DURATION, exec: "cold" },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate==1"],
    "http_req_duration{flow:create}": ["p(95)<200"],
    "http_req_duration{flow:warm}": ["p(95)<200"],
    "http_req_duration{flow:cold}": ["p(95)<200"],
  },
};

function fixture(mode) {
  const response = http.get(`${FIXTURE_URL}/${mode}`, { tags: { flow: "fixture" } });
  if (!check(response, { "fixture created": (r) => r.status === 200 })) return null;
  const result = response.json();
  if (!check(result, {
    "fixture has code and expected destination": (value) =>
      typeof value.code === "string" && value.destination === DESTINATION && value.ttlSeconds > 0,
  })) return null;
  return result;
}

function redirect(code, flow) {
  const response = http.get(`${BASE_URL}/${code}`, {
    redirects: 0,
    tags: { flow },
  });
  check(response, {
    "redirect status is 302": (r) => r.status === 302,
    "redirect points to the original URL": (r) => r.headers.Location === DESTINATION,
  });
}

export function setup() {
  const result = fixture("warm");
  if (!result) fail("Could not prepare warm-cache fixture");
  if (result.ttlSeconds < durationSeconds + 30) fail("Cache TTL is too short for the warm scenario");
  return result;
}

export function create() {
  const response = http.post(
    `${BASE_URL}/shorten`,
    JSON.stringify({ url: DESTINATION }),
    { headers: { "content-type": "application/json" }, tags: { flow: "create" } },
  );
  check(response, {
    "URL creation succeeds": (r) => r.status === 200,
    "URL creation returns a short URL": (r) => /^https?:\/\/.+\/[a-zA-Z0-9]{10}$/.test(r.body),
  });
}

export function warm(data) {
  redirect(data.code, "warm");
}

export function cold() {
  const result = fixture("cold");
  if (result) redirect(result.code, "cold");
}
