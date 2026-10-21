import assert from "node:assert/strict";
import test from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createAuthConfigService } from "../services/auth-config.service";
import { parseBooleanEnv } from "../utils/env";
import { createAuthConfigRoute } from "./auth-config";

test("public auth configuration contains only capabilities and cannot be cached", async () => {
  const service = createAuthConfigService({
    signupEnabled: false,
    googleEnabled: true,
    secret: "must-not-leak",
  } as Parameters<typeof createAuthConfigService>[0]);
  const response = await createAuthConfigRoute(service).request("http://test/");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    data: { signupEnabled: false, googleEnabled: true },
    error: null,
  });
});

test("auth configuration remains public in OpenAPI when the application requires a session", () => {
  const app = new OpenAPIHono();
  app.route(
    "/auth-config",
    createAuthConfigRoute(createAuthConfigService({ signupEnabled: true, googleEnabled: false })),
  );
  const document = app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: { title: "OpenMonetis API", version: "0.10.2" },
    security: [{ sessionCookie: [] }],
  });

  assert.deepEqual(document.security, [{ sessionCookie: [] }]);
  assert.deepEqual(document.paths?.["/auth-config"]?.get?.security, []);
});

test("registration flag accepts explicit booleans and rejects invalid configuration", () => {
  const original = process.env.DISABLE_SIGNUP;
  try {
    delete process.env.DISABLE_SIGNUP;
    assert.equal(parseBooleanEnv("DISABLE_SIGNUP"), false);
    process.env.DISABLE_SIGNUP = "true";
    assert.equal(parseBooleanEnv("DISABLE_SIGNUP"), true);
    process.env.DISABLE_SIGNUP = " false ";
    assert.equal(parseBooleanEnv("DISABLE_SIGNUP"), false);
    process.env.DISABLE_SIGNUP = "yes";
    assert.throws(() => parseBooleanEnv("DISABLE_SIGNUP"), /must be true or false/);
  } finally {
    if (original === undefined) delete process.env.DISABLE_SIGNUP;
    else process.env.DISABLE_SIGNUP = original;
  }
});
