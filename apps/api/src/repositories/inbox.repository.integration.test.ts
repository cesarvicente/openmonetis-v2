import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Opt-in: uses the configured development PostgreSQL server, creating and dropping
// a dedicated database. Existing databases and financial records are untouched.
test("identical captures are discarded as duplicates and different ones stay pending", {
  skip: process.env.INBOX_INTEGRATION_TEST !== "1",
}, async () => {
  const require = createRequire(new URL("../../../../packages/db/package.json", import.meta.url));
  require("dotenv").config({
    path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
    quiet: true,
  });
  const { Pool } = require("pg");
  const { migrate } = require("drizzle-orm/node-postgres/migrator");
  const { resolveDatabaseUrl } = await import("../../../../packages/db/src/database-url");
  assert.notEqual(process.env.NODE_ENV, "production", "Integration tests require development mode");
  const connectionUrl = new URL(process.env.TEST_DATABASE_URL ?? resolveDatabaseUrl());
  const admin = new Pool({ connectionString: connectionUrl.toString() });
  const databaseName = `openmonetis_inbox_test_${Date.now()}`;
  const originalExternalUrl = process.env.EXTERNAL_DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  let applicationPool: { end(): Promise<void> } | undefined;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  try {
    connectionUrl.pathname = `/${databaseName}`;
    process.env.NODE_ENV = "test";
    process.env.EXTERNAL_DATABASE_URL = connectionUrl.toString();
    const { db, pool } = await import("@openmonetis/db");
    applicationPool = pool;
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
    });
    const schema = await import("@openmonetis/db/schema");
    const { inboxRepository } = await import("./inbox.repository");
    const { inboxRulesRepository } = await import("./inbox-rules.repository");
    const { createInboxService } = await import("../services/inbox.service");
    const now = new Date("2026-11-12T15:00:00.000Z");
    const service = createInboxService(inboxRepository, {
      now: () => now,
      rulesRepository: inboxRulesRepository,
    });

    const [owner, stranger] = await db
      .insert(schema.user)
      .values([
        { name: "Owner", email: "owner@example.test" },
        { name: "Stranger", email: "stranger@example.test" },
      ])
      .returning();
    const [ownerToken, strangerToken] = await db
      .insert(schema.deviceTokens)
      .values([
        {
          userId: owner.id,
          name: "Phone",
          tokenDigest: "a".repeat(64),
          tokenPrefix: "omd_own",
          expiresAt: new Date("2027-11-12T00:00:00.000Z"),
        },
        {
          userId: stranger.id,
          name: "Phone",
          tokenDigest: "b".repeat(64),
          tokenPrefix: "omd_str",
          expiresAt: new Date("2027-11-12T00:00:00.000Z"),
        },
      ])
      .returning();
    const capture = {
      sourceApp: "com.itau",
      sourceAppName: "Itaú",
      originalTitle: "Compra aprovada",
      originalText: "Compra aprovada de R$ 8,94 em DL *UberRides no seu cartão Samsung Itau.",
      notificationTimestamp: "2026-11-12T14:36:00.000Z",
      timestampFormatVersion: 2 as const,
      parsedName: "DL *UberRides",
      parsedAmount: 8.94,
    };
    const ownerContext = { userId: owner.id, deviceTokenId: ownerToken.id };
    const statusOf = async (id: string) => service.get(id, owner.id);

    const original = await service.ingest({ ...capture, clientId: "n-1" }, ownerContext);
    assert.equal((await statusOf(original.id)).status, "pending");

    // Same content, new notification identifier: discarded as duplicate on arrival.
    const copy = await service.ingest({ ...capture, clientId: "n-2" }, ownerContext);
    const copyItem = await statusOf(copy.id);
    assert.equal(copyItem.status, "discarded");
    assert.equal(copyItem.discardReason, "duplicate");

    // A retry of the same notification returns the stored capture instead of a new one.
    const retry = await service.ingest({ ...capture, clientId: "n-1" }, ownerContext);
    assert.equal(retry.id, original.id);
    assert.equal(retry.duplicate, true);

    // Any single different field keeps the capture pending.
    const variations = [
      { originalTitle: "Compra aprovada!" },
      { originalText: `${capture.originalText} Boas compras.` },
      { notificationTimestamp: "2026-11-12T14:37:00.000Z" },
      { parsedAmount: 8.95 },
      { sourceAppName: "Itaú Cartões" },
      { sourceApp: "com.itau.cartoes" },
      { parsedName: "Uber" },
    ];
    for (const [index, variation] of variations.entries()) {
      const result = await service.ingest(
        { ...capture, ...variation, clientId: `variation-${index}` },
        ownerContext,
      );
      const item = await statusOf(result.id);
      assert.equal(item.status, "pending", JSON.stringify(variation));
      assert.equal(item.discardReason, null);
    }

    // Duplicates are per user: another user's identical capture is not affected.
    const strangerCapture = await service.ingest(
      { ...capture, clientId: "n-1" },
      { userId: stranger.id, deviceTokenId: strangerToken.id },
    );
    assert.equal((await service.get(strangerCapture.id, stranger.id)).status, "pending");

    // A batch carrying the same content twice keeps only the first one pending.
    const batch = await service.ingestBatch(
      [
        { ...capture, originalTitle: "Pix recebido", clientId: "batch-1" },
        { ...capture, originalTitle: "Pix recebido", clientId: "batch-2" },
      ],
      ownerContext,
    );
    const [first, second] = batch.map((item) => item.serverId as string);
    assert.equal((await statusOf(first as string)).status, "pending");
    assert.equal((await statusOf(second as string)).discardReason, "duplicate");

    // Restoring a duplicate makes it a regular pending capture again.
    const restored = await service.restore(copy.id, owner.id);
    assert.equal(restored.status, "pending");
    assert.equal(restored.discardReason, null);

    // A discard rule discards new matching captures of its owner only.
    const [discardRule] = await db
      .insert(schema.inboxRules)
      .values({
        userId: owner.id,
        name: "Descartar ofertas",
        conditions: [{ field: "originalText", operator: "contains", value: "promoção" }],
        action: "discard",
      })
      .returning();
    const offer = { ...capture, originalText: "Aproveite a PROMOCAO de hoje" };
    const discarded = await service.ingest({ ...offer, clientId: "offer-1" }, ownerContext);
    const discardedItem = await statusOf(discarded.id);
    assert.equal(discardedItem.status, "discarded");
    assert.equal(discardedItem.discardReason, "rule");
    const strangerOffer = await service.ingest(
      { ...offer, clientId: "offer-1" },
      { userId: stranger.id, deviceTokenId: strangerToken.id },
    );
    assert.equal((await service.get(strangerOffer.id, stranger.id)).status, "pending");

    // The discarded tab can be filtered by the rule, and a restored capture stays pending.
    const filtered = await service.list(
      { status: "discarded", page: 1, pageSize: 20, ruleId: discardRule.id },
      owner.id,
    );
    assert.deepEqual(
      filtered.items.map((item) => item.id),
      [discarded.id],
    );
    assert.equal((await service.restore(discarded.id, owner.id)).status, "pending");
  } finally {
    await applicationPool?.end();
    if (originalExternalUrl === undefined) delete process.env.EXTERNAL_DATABASE_URL;
    else process.env.EXTERNAL_DATABASE_URL = originalExternalUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    try {
      await admin.query(`DROP DATABASE "${databaseName}"`);
    } finally {
      await admin.end();
    }
  }
});
