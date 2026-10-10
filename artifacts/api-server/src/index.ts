import app from "./app";
import { logger } from "./lib/logger";
import { startPushDeliveryWorker } from "./lib/push-delivery";
import { startScheduledJobs } from "./lib/scheduled-jobs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const bindAddress = process.env["API_BIND_ADDRESS"]?.trim() || "0.0.0.0";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

startPushDeliveryWorker();
startScheduledJobs();

app.listen(port, bindAddress, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, bindAddress }, "Server listening");
});
