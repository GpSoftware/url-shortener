# URL Shortener

## Docker Compose (local development)

```sh
docker compose up --build -d --wait
docker compose logs -f api
docker compose down
```

The API is available at `http://localhost:3000` by default.
Use `GET /health` for liveness and `GET /ready` for readiness. Readiness
queries PostgreSQL and returns 503 when it is unavailable; Redis is optional
for redirects and is not included in readiness. Compose uses readiness as its
API health check. PostgreSQL and Redis have
health checks, and the API waits for both services to be ready before starting.
Data is preserved in named volumes when the containers are stopped.

Compose reads variables from the existing `.env` file without modifying it.
See [.env.example](./.env.example) for the available options. If you do not
have a `.env` file, you can copy that example. If you change `PORT`, also
update `BASE_URL` to the corresponding public URL.

Inside Docker, the API uses `postgres:5432` and `redis:6379`. From the host,
PostgreSQL and Redis are only exposed on `127.0.0.1`, using ports
`POSTGRES_PORT` (5432) and `REDIS_PORT` (6379). These published ports do not
change the internal connections.

`DB_USER`, `DB_PASSWORD`, and `DB_NAME` are shared between the API and
PostgreSQL. The default credentials are for development only. PostgreSQL
applies these variables when initializing an empty volume; changing them later
does not update existing users or databases.

Compose sets `DB_SYNCHRONIZE=true` to create tables when starting a new
database because the project does not have migrations yet. Do not use this in
production or with important data: it may alter the schema. Synchronization is
disabled by default outside Compose. For production, implement migrations and
set `DB_SYNCHRONIZE=false`.

Redis persists data using AOF and exposes `REDIS_URL` in the API configuration.
The API uses Redis to cache URLs and queue click analytics.
New cache entries expire after `CACHE_TTL_SECONDS` (default: 86400). Entries
written before this setting was introduced may not have a TTL. Completed jobs
are retained for up to one day or 10000 jobs; failed jobs for up to seven days
or 5000 jobs. BullMQ evaluates retention when subsequent jobs finish or fail,
not on a timer.

Click analytics are best effort: redirects do not wait for enqueueing, and
clicks can be lost when Redis is unavailable or the API stops. Count structured
logs with `event: "analytics_enqueue_failed"` to monitor failed or skipped
enqueue attempts. A command timeout does not guarantee that Redis rejected the
job.

Run the automated tests with:

```sh
npm test
```

Run the load tests against a dedicated development environment:

```sh
npm run test:load
```

The load profile starts a private fixture service that creates new URLs and
verifies their cache state. For cold reads it deletes only the newly created
URL's cache key. The test creates persistent database records and analytics
jobs; do not run it against production. It measures creation, warm redirects
and cold redirects separately, verifies the exact redirect destination, and
applies p95 and error-rate thresholds. Set `LOAD_VUS` and `LOAD_DURATION` in
the k6 service environment to change the default 20 users per scenario and
one-minute duration. `LOAD_DURATION` accepts whole seconds, minutes, or hours
(for example, `30s` or `2m`). The warm scenario requires a cache TTL longer
than the test duration plus 30 seconds.

## API Outside Docker

With PostgreSQL and Redis available and `.env` configured:

```sh
npm ci
npm run dev
```

The API validates environment variables before connecting to PostgreSQL.
`HOST` controls the local listening interface; Compose sets it to `0.0.0.0`.
The image uses Node.js 24, compiles TypeScript in a separate build stage, and
runs the API with production dependencies under an unprivileged user.
