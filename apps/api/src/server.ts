import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db.js";
import { createServer } from "node:http";
import { initRealtime } from "./realtime/socket.js";
const server = createServer(app);
const realtime = initRealtime(server);
server.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
pool.on("error", (error) => console.error("Database pool error", error.name));
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  realtime.close(async () => {
    try {
      await pool.end();
      clearTimeout(timeout);
      process.exitCode = 0;
    } catch {
      process.exitCode = 1;
    }
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
