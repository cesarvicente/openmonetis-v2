import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Passkey user",
      email: `${randomUUID()}@example.test`,
      password: "passkey-test-password-123",
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  await page.goto("/");
  return body.user.id as string;
}
async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}
async function addPasskey(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/lib/auth-client.ts";
    const { authClient } = await import(path);
    const result = await authClient.passkey.addPasskey({ name: "Virtual security key" });
    return { error: result.error?.code ?? null };
  });
}
async function listPasskeys(page: Page) {
  const response = await page.request.get("/api/auth/passkey/list-user-passkeys");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Array<{ id: string; name: string }>;
}

test("passkey enrollment, passwordless login, replay protection, rename and revocation use real WebAuthn verification", async ({
  page,
}) => {
  const userId = await register(page);
  const { cdp, authenticatorId } = await authenticator(page);
  try {
    expect(await addPasskey(page)).toEqual({ error: null });
    const keys = await listPasskeys(page);
    expect(keys).toHaveLength(1);
    const key = keys[0];
    expect(key.name).toBe("Virtual security key");
    await page.request.post("/api/auth/sign-out", { data: {} });
    await page.goto("/");
    let assertion: unknown;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/auth/passkey/verify-authentication"))
        assertion = request.postDataJSON();
    });
    await page.getByRole("button", { name: "Entrar com chave de acesso", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    const session = await page.request.get("/api/auth/get-session");
    expect((await session.json()).user.id).toBe(userId);
    expect(assertion).toBeTruthy();
    const replay = await page.request.post("/api/auth/passkey/verify-authentication", {
      data: assertion,
    });
    expect(replay.ok()).toBeFalsy();
    const rename = await page.request.post("/api/auth/passkey/update-passkey", {
      data: { id: key.id, name: "Renamed key" },
    });
    expect(rename.ok()).toBeTruthy();
    expect((await listPasskeys(page))[0].name).toBe("Renamed key");
    const removed = await page.request.post("/api/auth/passkey/delete-passkey", {
      data: { id: key.id },
    });
    expect(removed.ok()).toBeTruthy();
    expect(await listPasskeys(page)).toEqual([]);
    await page.request.post("/api/auth/sign-out", { data: {} });
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const path = "/src/lib/auth-client.ts";
      const { authClient } = await import(path);
      const result = await authClient.signIn.passkey();
      return { error: result.error?.code ?? null };
    });
    expect(result.error).toBeTruthy();
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});

test("another account cannot rename or delete a registered passkey", async ({ page, browser }) => {
  await register(page);
  const { cdp, authenticatorId } = await authenticator(page);
  const stranger = await browser.newContext({ baseURL: "http://localhost:17002" });
  try {
    expect(await addPasskey(page)).toEqual({ error: null });
    const [key] = await listPasskeys(page);
    const created = await stranger.request.post("/api/auth/sign-up/email", {
      data: {
        name: "Stranger",
        email: `${randomUUID()}@example.test`,
        password: "passkey-test-password-123",
      },
    });
    expect(created.ok()).toBeTruthy();
    const createdUser = (await created.json()).user;
    const strangerSession = await stranger.request.get("/api/auth/get-session");
    expect((await strangerSession.json()).user.id).toBe(createdUser.id);
    for (const [path, data] of [
      ["update-passkey", { id: key.id, name: "Stolen" }],
      ["delete-passkey", { id: key.id }],
    ] as const) {
      const response = await stranger.request.post(`/api/auth/passkey/${path}`, { data });
      expect(response.status()).toBe(401);
    }
    expect((await listPasskeys(page))[0]).toMatchObject({
      id: key.id,
      name: "Virtual security key",
    });
  } finally {
    await stranger.close();
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});

test("passkey registration requires a session and rejects a credential without verified-user proof", async ({
  page,
}) => {
  expect((await page.request.get("/api/auth/passkey/generate-register-options")).status()).toBe(
    401,
  );
  await register(page);
  const { cdp, authenticatorId } = await authenticator(page);
  try {
    await cdp.send("WebAuthn.setResponseOverrideBits", { authenticatorId, isBadUV: true });
    const result = await addPasskey(page);
    expect(result.error).toBeTruthy();
    expect(await listPasskeys(page)).toEqual([]);
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});
