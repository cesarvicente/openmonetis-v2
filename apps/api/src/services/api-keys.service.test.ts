import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { apiKeyMaximumActiveCount } from "@openmonetis/domain/api-keys";
import { type ApiKeyRepository, createApiKeysService } from "./api-keys.service";

const now = new Date("2026-10-29T12:00:00.000Z");
const secret = "a-development-secret-with-at-least-32-characters";
const userId = "00000000-0000-4000-8000-000000000001";
const keyId = "00000000-0000-4000-8000-000000000002";

function digest(key: string) {
  return createHmac("sha256", secret).update(`api-key:${key}`, "utf8").digest("hex");
}

function createRepository(overrides: Partial<ApiKeyRepository> = {}): ApiKeyRepository {
  return {
    insertIfBelowActiveLimit: async (data) => ({
      id: keyId,
      ...data,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    }),
    listActiveForUser: async () => [],
    findActiveByDigest: async () => null,
    touchLastUsed: async () => undefined,
    revokeForUser: async () => false,
    ...overrides,
  };
}

test("API key creation returns the key once and stores only its digest", async () => {
  let stored = null as Parameters<ApiKeyRepository["insertIfBelowActiveLimit"]>[0] | null;
  let receivedMaximum = 0;
  const service = createApiKeysService(
    createRepository({
      insertIfBelowActiveLimit: async (data, _now, maximum) => {
        stored = data;
        receivedMaximum = maximum;
        return { id: keyId, ...data, lastUsedAt: null, revokedAt: null, createdAt: now };
      },
    }),
    { secret, now: () => now },
  );

  const result = await service.create({ name: "  Agente   de IA ", expiresInDays: 90 }, userId);

  assert.match(result.key, /^omk_[A-Za-z0-9_-]{43}$/);
  assert.equal(result.name, "Agente de IA");
  assert.equal(result.keyPrefix, result.key.slice(0, 12));
  assert.equal(result.expiresAt, "2027-01-27T12:00:00.000Z");
  assert.equal(stored?.keyDigest, digest(result.key));
  assert.equal(JSON.stringify(stored).includes(result.key), false);
  assert.equal(receivedMaximum, apiKeyMaximumActiveCount);
  assert.equal("key" in (await service.list(userId)), false);
});

test("API keys without a lifetime never expire", async () => {
  const service = createApiKeysService(createRepository(), { secret, now: () => now });
  const result = await service.create({ name: "Importador", expiresInDays: null }, userId);
  assert.equal(result.expiresAt, null);
});

test("API key creation reports the active-key limit", async () => {
  const service = createApiKeysService(
    createRepository({ insertIfBelowActiveLimit: async () => null }),
    { secret, now: () => now },
  );

  await assert.rejects(
    service.create({ name: "Agente", expiresInDays: null }, userId),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "api_key_limit_reached",
  );
});

test("API key authentication resolves the owner only for active keys in the exact format", async () => {
  const rawKey = `omk_${"c".repeat(43)}`;
  let touchedId: string | null = null;
  const service = createApiKeysService(
    createRepository({
      findActiveByDigest: async (keyDigest) =>
        keyDigest === digest(rawKey)
          ? {
              id: keyId,
              userId,
              name: "Agente",
              keyDigest,
              keyPrefix: rawKey.slice(0, 12),
              lastUsedAt: null,
              expiresAt: null,
              revokedAt: null,
              createdAt: now,
            }
          : null,
      touchLastUsed: async (id) => {
        touchedId = id;
      },
    }),
    { secret, now: () => now },
  );

  assert.equal(await service.authenticate(null), null);
  assert.equal(await service.authenticate(`opm_${"c".repeat(43)}`), null);
  assert.equal(await service.authenticate(`omk_${"d".repeat(43)}`), null);
  assert.deepEqual(await service.authenticate(rawKey), { keyId, userId });
  assert.equal(touchedId, keyId);
});

test("API key revocation is scoped to the owner", async () => {
  let received: [string, string] | null = null;
  const service = createApiKeysService(
    createRepository({
      revokeForUser: async (id, ownerId) => {
        received = [id, ownerId];
        return false;
      },
    }),
    { secret, now: () => now },
  );

  await assert.rejects(
    service.revoke(keyId, userId),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "api_key_not_found",
  );
  assert.deepEqual(received, [keyId, userId]);
});
