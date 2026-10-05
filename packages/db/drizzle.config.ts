import "dotenv/config";
import { defineConfig } from "drizzle-kit";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  throw new Error(
    "Set a PostgreSQL DATABASE_URL in packages/db/.env before running database tools",
  );
}
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
