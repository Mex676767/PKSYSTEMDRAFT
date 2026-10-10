import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { runtimeConfig } from "./lib/runtime-config";
import type { ErrorRequestHandler } from "express";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Non-browser calls (health probes, local tooling) have no Origin header.
      if (!origin || runtimeConfig.allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed."));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  logger.error({ err: error, requestId: req.id }, "API request failed");
  if (res.headersSent) return;
  res.status(500).json({ error: "The request could not be completed." });
};
app.use(errorHandler);

export default app;
