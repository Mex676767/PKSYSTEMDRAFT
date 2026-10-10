import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { runtimeConfig } from "../lib/runtime-config";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({ ...data, tenant: runtimeConfig.tenant });
});

router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ready", tenant: runtimeConfig.tenant });
  } catch {
    res.status(503).json({ status: "unavailable", tenant: runtimeConfig.tenant });
  }
});

export default router;
