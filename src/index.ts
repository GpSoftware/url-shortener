import buildApp from "./app.js";

const app = buildApp({ logger: true });

const start = async () => {
  try {
    await app.ready();
    await app.listen({ port: app.config.PORT, host: app.config.HOST });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();