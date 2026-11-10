import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 300 },
    { duration: "1m", target: 600 },
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 1500 },
    { duration: "2m", target: 1500 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<200"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const longUrls = new SharedArray("urls to shorten", function () {
  return [
    "https://wikipedia.org",
    "https://grafana.com",
    "https://github.com",
    "https://dev.to/nk18chi/build-a-url-shortener-using-react-and-nodeexpress-in-typescript-3p68",
  ];
});

export default function () {
  const randomUrl = longUrls[Math.floor(Math.random() * longUrls.length)];

  const payload = JSON.stringify({ url: randomUrl });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const postResponse = http.post(`${BASE_URL}/shorten`, payload, params);

  const isPostOk = check(postResponse, {
    "POST /shorten response 200": (r) => r.status === 200,
    "POST /shorten return short URL": (r) => {
      const body = r.body || "";
      return body.includes("/") && body.trim().length > 0;
    },
  });

  if (!isPostOk) {
    return;
  }

  const shortUrl = (postResponse.body || "").replace(/^"|"$/g, "").trim();
  const shortCode = shortUrl.split("/").pop();
  if (!shortCode) {
    return;
  }

  const getResponse = http.get(`${BASE_URL}/${shortCode}`, { redirects: 0 });

  check(getResponse, {
    "GET /:code returns redirect": (r) =>
      r.status === 301 ||
      r.status === 302 ||
      r.status === 307 ||
      r.status === 308,
    "GET /:code includes Location header": (r) =>
      Object.prototype.hasOwnProperty.call(r.headers, "Location"),
  });

}
