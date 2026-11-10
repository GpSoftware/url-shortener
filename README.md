# URL Shortener

## Docker Compose (desarrollo local)

```sh
docker compose up --build -d --wait
docker compose logs -f api
docker compose down
```

La API queda disponible en `http://localhost:3000` por defecto.
`GET /health` permite comprobar que arranco. PostgreSQL y Redis tienen
healthchecks y la API espera a que ambos esten listos antes de arrancar.
Los datos se conservan en volumenes nombrados al detener los contenedores.

Compose toma las variables del archivo `.env` existente, sin modificarlo.
Consulta [.env.example](./.env.example) para ver las opciones. Si no tienes
un `.env`, puedes copiar ese ejemplo. Si cambias `PORT`, actualiza tambien
`BASE_URL` con la URL publica correspondiente.

Dentro de Docker, la API usa `postgres:5432` y `redis:6379`. Desde el host,
PostgreSQL y Redis solo se publican en `127.0.0.1`, en los puertos
`POSTGRES_PORT` (5432) y `REDIS_PORT` (6379). Estos puertos publicados no
modifican las conexiones internas.

`DB_USER`, `DB_PASSWORD` y `DB_NAME` se comparten entre la API y PostgreSQL.
Las credenciales por defecto son solo para desarrollo. PostgreSQL aplica
estas variables al inicializar un volumen vacio; cambiarlas despues no
actualiza usuarios ni bases ya existentes.

Compose activa `DB_SYNCHRONIZE=true` para crear las tablas al iniciar una
base nueva, ya que el proyecto todavia no tiene migraciones. No usarlo en
produccion ni con datos importantes: puede alterar el esquema. Fuera de
Compose, la sincronizacion esta desactivada por defecto. Para produccion,
implementar migraciones y definir `DB_SYNCHRONIZE=false`.

Redis persiste datos con AOF y expone `REDIS_URL` en la configuracion de
la API. La aplicacion todavia no tiene un cliente Redis ni logica de cache.

## API fuera de Docker

Con PostgreSQL y Redis disponibles y `.env` configurado:

```sh
npm ci
npm run dev
```

La API valida las variables de entorno antes de conectarse a PostgreSQL.
`HOST` controla la interfaz de escucha local; Compose lo fija en `0.0.0.0`.
La imagen usa Node.js 24, compila TypeScript en una etapa separada y ejecuta
la API con dependencias de produccion y un usuario sin privilegios.
