import { Pool } from "pg";
export * from "./schema/index.js";

export function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  async function query<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(text: string, params: unknown[] = []): Promise<T[]> {
    return (await pool.query<T>(text, params)).rows;
  }
  async function queryOne<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(text: string, params: unknown[] = []): Promise<T | null> {
    return (await query<T>(text, params))[0] ?? null;
  }
  return { pool, query, queryOne };
}
