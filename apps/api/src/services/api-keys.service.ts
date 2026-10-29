import { createHmac, randomBytes } from "node:crypto";
import {
  apiKeyMaximumActiveCount,
  apiKeyPrefix,
  getApiKeyExpiration,
  hasApiKeyFormat,
  normalizeApiKeyName,
} from "@openmonetis/domain/api-keys";
import type {
  ApiKeyOutput,
  CreateApiKeyInput,
  CreatedApiKeyOutput,
} from "@openmonetis/validators/api-keys";
import { conflict, notFound } from "../utils/errors";

type ApiKeyRecord = {
  id: string;
  userId: string;
  name: string;
  keyDigest: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type ApiKeyRepository = {
  insertIfBelowActiveLimit(
    data: {
      userId: string;
      name: string;
      keyDigest: string;
      keyPrefix: string;
      expiresAt: Date | null;
    },
    now: Date,
    maximumActiveCount: number,
  ): Promise<ApiKeyRecord | null>;
  listActiveForUser(userId: string, now: Date): Promise<ApiKeyRecord[]>;
  findActiveByDigest(keyDigest: string, now: Date): Promise<ApiKeyRecord | null>;
  touchLastUsed(id: string, usedAt: Date): Promise<void>;
  revokeForUser(id: string, userId: string, revokedAt: Date): Promise<boolean>;
};

type ApiKeyPrincipal = {
  keyId: string;
  userId: string;
};

export function createApiKeysService(
  repository: ApiKeyRepository,
  options: { secret: string; now?: () => Date } = { secret: "" },
) {
  if (options.secret.length < 32) {
    throw new Error("API key secret must contain at least 32 characters");
  }

  const now = options.now ?? (() => new Date());
  // The label keeps API key digests separate from other credentials sharing the same secret.
  const digest = (key: string) =>
    createHmac("sha256", options.secret).update(`api-key:${key}`, "utf8").digest("hex");

  return {
    async create(input: CreateApiKeyInput, userId: string): Promise<CreatedApiKeyOutput> {
      const createdAt = now();
      const key = `${apiKeyPrefix}${randomBytes(32).toString("base64url")}`;
      const record = await repository.insertIfBelowActiveLimit(
        {
          userId,
          name: normalizeApiKeyName(input.name),
          keyDigest: digest(key),
          keyPrefix: key.slice(0, 12),
          expiresAt: getApiKeyExpiration(input.expiresInDays, createdAt),
        },
        createdAt,
        apiKeyMaximumActiveCount,
      );

      if (!record) {
        throw conflict(
          "Revoke an existing API key before creating another",
          "api_key_limit_reached",
        );
      }

      return { ...toOutput(record), key };
    },

    async list(userId: string): Promise<ApiKeyOutput[]> {
      const records = await repository.listActiveForUser(userId, now());
      return records.map(toOutput);
    },

    async revoke(id: string, userId: string) {
      const revoked = await repository.revokeForUser(id, userId, now());
      if (!revoked) throw notFound("API key not found", "api_key_not_found");
      return { id };
    },

    async authenticate(rawKey: string | null): Promise<ApiKeyPrincipal | null> {
      if (!rawKey || !hasApiKeyFormat(rawKey)) return null;

      const usedAt = now();
      const record = await repository.findActiveByDigest(digest(rawKey), usedAt);
      if (!record) return null;

      await repository.touchLastUsed(record.id, usedAt);
      return { keyId: record.id, userId: record.userId };
    },
  };
}

function toOutput(record: ApiKeyRecord): ApiKeyOutput {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export type ApiKeysService = ReturnType<typeof createApiKeysService>;
