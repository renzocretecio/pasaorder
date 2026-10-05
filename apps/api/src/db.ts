import { createDatabase } from "@pasaorder/db";
import { env } from "./config/env.js";
export const { pool, query, queryOne } = createDatabase(env.DATABASE_URL);
