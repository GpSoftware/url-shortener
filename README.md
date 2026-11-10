# URL Shortener

## Docker Compose (local development)

```sh
docker compose up --build -d --wait
docker compose logs -f api
docker compose down
```

The API is available at `http://localhost:3000` by default.
Use `GET /health` to check that it has started. PostgreSQL and Redis have
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
The application does not yet have a Redis client or caching logic.

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
