import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { logUnhandledError, validateApiRequest } from "./lib/requestSecurity";
import { generalRateLimiter } from "./lib/rateLimit";
import { AppError } from "./lib/errors";

const app: Express = express();
app.set("trust proxy", 1);

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
app.use("/api", generalRateLimiter);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb", parameterLimit: 100 }));

app.use("/api", validateApiRequest, router);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    logger.warn({
      code: error.code,
      status: error.status,
      method: req.method,
      path: req.path,
    }, "Expected API error");
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  logUnhandledError(error, req);
  const status = typeof error === "object" && error !== null && "status" in error
    && typeof error.status === "number" ? error.status : 500;
  if (status === 413) {
    res.status(413).json({ error: "Request payload too large", code: "PAYLOAD_TOO_LARGE" });
    return;
  }
  if (status === 400) {
    res.status(400).json({ error: "Malformed request", code: "INVALID_REQUEST" });
    return;
  }
  res.status(500).json({ error: "An internal error occurred", code: "INTERNAL_ERROR" });
});

export default app;
