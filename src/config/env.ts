export interface AppConfig {
  PORT: number;
  HOST: string;
  BASE_URL: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SYNCHRONIZE: boolean;
  REDIS_URL: string;
}

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

const schema = {
  type: "object",
  required: ["PORT", "BASE_URL"],
  properties: {
    PORT: {
      type: "integer",
      minimum: 1,
      maximum: 65535,
      default: 3000,
    },
    HOST: {
      type: "string",
      default: "127.0.0.1",
    },
    BASE_URL: {
      type: "string",
      default: "http://localhost:3000",
    },
    DB_HOST: { type: "string", default: "localhost", minLength: 1 },
    DB_PORT: { type: "integer", default: 5432, minimum: 1, maximum: 65535 },
    DB_USER: { type: "string", default: "test", minLength: 1 },
    DB_PASSWORD: { type: "string", default: "test", minLength: 1 },
    DB_NAME: { type: "string", default: "test", minLength: 1 },
    DB_SYNCHRONIZE: { type: "boolean", default: false },
    REDIS_URL: { type: "string", default: "redis://localhost:6379", minLength: 1 },
  },
};

const envsOptions = {
  confKey: "config",
  schema: schema,
  dotenv: true,
};

export default envsOptions;
