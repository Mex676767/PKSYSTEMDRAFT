import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.TENANT_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TENANT_DATABASE_URL must be set for the API runtime.");
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
