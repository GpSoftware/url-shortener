"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/scripts/shortener-test.ts
  var import_http = __toESM(__require("k6/http"), 1);
  var import_k6 = __require("k6");
  var import_data = __require("k6/data");
  var options = {
    stages: [
      { duration: "30s", target: 20 },
      { duration: "1m", target: 20 },
      { duration: "30s", target: 0 }
    ],
    thresholds: {
      http_req_failed: ["rate<0.01"],
      http_req_duration: ["p(95)<200"]
    }
  };
  var BASE_URL = __ENV["BASE_URL"] || "http://localhost:3000";
  var longUrls = new import_data.SharedArray("urls to shorten", function() {
    return [
      "https://wikipedia.org",
      "https://grafana.com",
      "https://github.com",
      "https://dev.to/nk18chi/build-a-url-shortener-using-react-and-nodeexpress-in-typescript-3p68"
    ];
  });
  function shortener_test_default() {
    const randomUrl = longUrls[Math.floor(Math.random() * longUrls.length)];
    const payload = JSON.stringify({ url: randomUrl });
    const params = {
      headers: {
        "Content-Type": "application/json"
      }
    };
    const postResponse = import_http.default.post(`${BASE_URL}/shorten`, payload, params);
    const isPostOk = (0, import_k6.check)(postResponse, {
      "POST /api/shorten status es 201 o 200": (r) => r.status === 201 || r.status === 200,
      "POST /api/shorten retorna un ID/shortUrl": (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.shortCode || body.id || body.shortUrl);
        } catch (e) {
          return false;
        }
      }
    });
    if (!isPostOk) {
      (0, import_k6.sleep)(1);
      return;
    }
    const jsonBody = JSON.parse(postResponse.body);
    const shortCode = jsonBody.shortCode || jsonBody.id || jsonBody.shortUrl;
    (0, import_k6.sleep)(1);
    const getResponse = import_http.default.get(`${BASE_URL}/${shortCode}`);
    (0, import_k6.check)(getResponse, {
      "GET /:code retorna redirecci\xF3n (301/302/307)": (r) => r.status === 301 || r.status === 302 || r.status === 307,
      "GET /:code incluye cabecera Location": (r) => r.headers.hasOwnProperty("Location")
    });
    (0, import_k6.sleep)(Math.random() * 2 + 1);
  }
})();
