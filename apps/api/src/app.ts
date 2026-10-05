import express from "express";
import cors from "cors";
import helmet from "helmet";
import apiRouter from "./modules/index.js";
import { env } from "./config/env.js";
import { pool } from "./db.js";
import { errorHandler } from "./middleware/errors.js";
const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "pasaorder-api" }),
);
app.get("/api/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use("/api", apiRouter);
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);
export default app;
