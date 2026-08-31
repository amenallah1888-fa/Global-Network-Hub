import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { logUnhandledError, validateApiRequest } from "./lib/requestSecurity";

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
app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb", parameterLimit: 100 }));

app.use("/api", validateApiRequest, router);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logUnhandledError(error, req);
  if (res.headersSent) return;
  res.status(500).json({ error: "An internal error occurred", code: "INTERNAL_ERROR" });
});

export default app;
