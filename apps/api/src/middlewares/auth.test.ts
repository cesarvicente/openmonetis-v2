import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import type { ApiVariables } from "../types/context";
import { createRequireAuth, requireSession } from "./auth";

const userId = "00000000-0000-4000-8000-000000000001";
const validKey = `omk_${"a".repeat(43)}`;

function createApp() {
  const app = new Hono<{ Variables: ApiVariables }>();
  const requireAuth = createRequireAuth({
    authenticate: async (key) =>
      key === validKey ? { keyId: "00000000-0000-4000-8000-000000000002", userId } : null,
  });
  app.use("*", requireAuth);
  app.get("/data", (context) =>
    context.json({
      userId: context.get("userId"),
      role: context.get("userRole"),
      method: context.get("authMethod"),
    }),
  );
  app.use("/settings", requireSession);
  app.get("/settings", (context) => context.json({ ok: true }));
  return app;
}

test("API keys authenticate as a member of their owner", async () => {
  const response = await createApp().request("/data", {
    headers: { Authorization: `Bearer ${validKey}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId, role: "member", method: "apiKey" });
});

test("an invalid Authorization header is rejected without falling back to the cookie", async () => {
  for (const authorization of [`Bearer omk_${"b".repeat(43)}`, `Basic ${validKey}`, ""]) {
    const response = await createApp().request("/data", {
      headers: { Authorization: authorization, Cookie: "better-auth.session_token=anything" },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "invalid_api_key");
  }
});

test("routes that require a web session refuse API keys", async () => {
  const response = await createApp().request("/settings", {
    headers: { Authorization: `Bearer ${validKey}` },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "session_required");
});
