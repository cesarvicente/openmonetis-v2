import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Opt-in: uses the configured development PostgreSQL server, creating and dropping
// a dedicated database. Existing databases and financial records are untouched.
test("inbox rules suggest a card or an account from the capture text", {
  skip: process.env.INBOX_RULES_INTEGRATION_TEST !== "1",
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
  const databaseName = `openmonetis_inbox_rules_test_${Date.now()}`;
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
    const { eq } = await import("drizzle-orm");
    const { inboxRulesRepository } = await import("./inbox-rules.repository");
    const { createInboxRulesService } = await import("../services/inbox-rules.service");
    const service = createInboxRulesService(inboxRulesRepository);

    const [owner, stranger] = await db
      .insert(schema.user)
      .values([
        { name: "Owner", email: "owner@example.test" },
        { name: "Stranger", email: "stranger@example.test" },
      ])
      .returning();
    const [account, strangerAccount] = await db
      .insert(schema.financialAccounts)
      .values([
        { userId: owner.id, name: "Itaú", type: "checking" },
        { userId: stranger.id, name: "Outra", type: "checking" },
      ])
      .returning();
    const [card] = await db
      .insert(schema.cards)
      .values({
        userId: owner.id,
        accountId: account.id,
        name: "Samsung Itaú",
        closingDay: 25,
        dueDay: 5,
      })
      .returning();
    const [transport] = await db
      .insert(schema.categories)
      .values({ userId: owner.id, name: "Transporte", type: "expense" })
      .returning();
    const [item] = await db
      .insert(schema.inboxItems)
      .values({
        userId: owner.id,
        sourceApp: "com.itau",
        sourceAppName: "Itaú",
        originalText:
          "Olá! Compra aprovada de R$ 8,94 em DL *UberRides no dia 30/10 às 16:36 no seu cartão Samsung Itau. Boas compras.",
        notificationTimestamp: new Date("2026-10-30T19:36:00.000Z"),
        parsedName: "DL *UberRides",
        parsedAmount: "8.94",
        clientId: "client-1",
        payloadFingerprint: "fingerprint-1",
      })
      .returning();

    const base = {
      priority: 10,
      isActive: true,
      matchMode: "all" as const,
      categoryId: null,
      personId: null,
      paymentMethod: null,
      cardId: null,
      accountId: null,
    };
    const cardRule = await service.create(
      {
        ...base,
        name: "Cartão Samsung",
        // Lowercase and accented on purpose: the capture says "Samsung Itau".
        conditions: [{ field: "originalText", operator: "contains", value: "samsung  itaú" }],
        paymentMethod: "credit_card",
        cardId: card.id,
      },
      owner.id,
    );
    assert.equal(cardRule.paymentMethod, "credit_card");
    assert.deepEqual(cardRule.card, { id: card.id, name: "Samsung Itaú" });
    await service.create(
      {
        ...base,
        name: "Uber",
        priority: 20,
        conditions: [{ field: "parsedName", operator: "contains", value: "UBER" }],
        categoryId: transport.id,
      },
      owner.id,
    );
    await service.create(
      {
        ...base,
        name: "Conta Itaú",
        priority: 30,
        conditions: [{ field: "sourceAppName", operator: "equals", value: "itau" }],
        paymentMethod: "debit_card",
        accountId: account.id,
      },
      owner.id,
    );

    const suggestion = await service.resolveSuggestion(item.id, owner.id);
    assert.equal(suggestion.paymentMethod, "credit_card");
    assert.equal(suggestion.cardId, card.id);
    assert.equal(suggestion.accountId, null);
    assert.equal(suggestion.categoryId, transport.id);
    assert.deepEqual(
      suggestion.appliedRules.map((rule) => [rule.name, rule.fields]),
      [
        ["Cartão Samsung", ["paymentMethod", "cardId"]],
        ["Uber", ["categoryId"]],
      ],
    );

    await db.update(schema.cards).set({ status: "inactive" }).where(eq(schema.cards.id, card.id));
    const withoutCard = await service.resolveSuggestion(item.id, owner.id);
    assert.equal(withoutCard.cardId, null);
    assert.equal(withoutCard.paymentMethod, "debit_card");
    assert.equal(withoutCard.accountId, account.id);

    await assert.rejects(
      service.create(
        {
          ...base,
          name: "Conta de outro usuário",
          conditions: [{ field: "originalText", operator: "contains", value: "compra" }],
          paymentMethod: "pix",
          accountId: strangerAccount.id,
        },
        owner.id,
      ),
      (error: { code?: string }) => error.code === "inbox_rule_account_unavailable",
    );
    await assert.rejects(
      db.insert(schema.inboxRules).values({
        userId: owner.id,
        name: "Cartão sem forma de pagamento",
        conditions: [{ field: "originalText", operator: "contains", value: "compra" }],
        cardId: card.id,
      }),
    );
    await assert.rejects(
      db.insert(schema.inboxRules).values({
        userId: owner.id,
        name: "Pix com cartão",
        conditions: [{ field: "originalText", operator: "contains", value: "compra" }],
        paymentMethod: "pix",
        cardId: card.id,
      }),
    );
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
