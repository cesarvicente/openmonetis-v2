import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { withIntegrationDatabase } from "./integration-database";

await withIntegrationDatabase(
  async () => {
    const { app } = await import("../app");
    const api = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 17001 });
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    let web: ChildProcess | undefined;
    try {
      await once(api, "listening");
      web = spawn(
        process.execPath,
        [
          `${root}apps/web/node_modules/vite/bin/vite.js`,
          "--host",
          "127.0.0.1",
          "--port",
          "17002",
          "--strictPort",
        ],
        {
          cwd: `${root}apps/web`,
          env: { ...process.env, API_INTERNAL_URL: "http://127.0.0.1:17001" },
          stdio: "inherit",
        },
      );
      await new Promise<void>((resolve, reject) => {
        process.once("SIGTERM", resolve);
        process.once("SIGINT", resolve);
        web?.once("error", reject);
        web?.once("exit", (code) => reject(new Error(`Browser test web server exited: ${code}`)));
      });
    } finally {
      if (web && web.exitCode === null && web.signalCode === null) {
        web.kill("SIGTERM");
        await once(web, "exit");
      }
      if (api.listening) {
        await new Promise<void>((resolve, reject) => {
          api.close((error) => (error ? reject(error) : resolve()));
          if ("closeAllConnections" in api) api.closeAllConnections();
        });
      }
    }
  },
  {
    environment: {
      WEB_URL: "http://localhost:17002",
      BETTER_AUTH_URL: "http://localhost:17002",
      CORS_ORIGIN: "http://localhost:17002",
    },
  },
);
