import { apiKeys, db } from "@openmonetis/db";
import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { ApiKeyRepository } from "../services/api-keys.service";

const isActive = (now: Date) =>
  and(isNull(apiKeys.revokedAt), or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)));

export const apiKeysRepository: ApiKeyRepository = {
  async insertIfBelowActiveLimit(data, now, maximumActiveCount) {
    return db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:api-key-limit`}, 0))`,
      );
      const [row] = await transaction
        .select({ value: count() })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, data.userId), isActive(now)));

      if (Number(row.value) >= maximumActiveCount) return null;

      const [record] = await transaction.insert(apiKeys).values(data).returning();
      return record ?? null;
    });
  },

  async listActiveForUser(userId, now) {
    return db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isActive(now)))
      .orderBy(desc(apiKeys.createdAt));
  },

  async findActiveByDigest(keyDigest, now) {
    const [record] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyDigest, keyDigest), isActive(now)))
      .limit(1);
    return record ?? null;
  },

  async touchLastUsed(id, usedAt) {
    const fiveMinutesAgo = new Date(usedAt.getTime() - 5 * 60 * 1_000);
    await db
      .update(apiKeys)
      .set({ lastUsedAt: usedAt, updatedAt: usedAt })
      .where(
        and(
          eq(apiKeys.id, id),
          or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, fiveMinutesAgo)),
        ),
      );
  },

  async revokeForUser(id, userId, revokedAt) {
    const [record] = await db
      .update(apiKeys)
      .set({ revokedAt, updatedAt: revokedAt })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    return Boolean(record);
  },
};
