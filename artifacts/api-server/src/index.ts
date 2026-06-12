import app from "./app";
import { logger } from "./lib/logger";
import { seedIfEmpty } from "./lib/seed";
import { startTimelockWorker } from "./lib/timelockWorker";
import { seedSkinCatalog } from "./lib/xpEngine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  try {
    await seedIfEmpty();
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }

  try {
    await seedSkinCatalog();
  } catch (err) {
    logger.error({ err }, "Skin catalog seed failed");
  }

  startTimelockWorker();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
})();
