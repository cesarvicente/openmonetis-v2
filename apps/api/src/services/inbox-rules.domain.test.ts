import assert from "node:assert/strict";
import test from "node:test";
import {
  createInboxRuleDraft,
  type InboxRuleCandidate,
  InboxRuleError,
  resolveInboxRules,
} from "@openmonetis/domain/inbox-rules";

const item = {
  sourceApp: "com.nu.production",
  sourceAppName: "Nubank",
  originalTitle: "Compra aprovada",
  originalText: "Compra aprovada no IFOOD *RESTAURANTE no valor de R$ 42,90",
  parsedName: "iFood Restaurante",
  parsedAmount: 42.9,
};

function rule(overrides: Partial<InboxRuleCandidate>): InboxRuleCandidate {
  return {
    id: "rule-default",
    name: "Regra padrão",
    priority: 100,
    isActive: true,
    matchMode: "all",
    conditions: [{ field: "originalText", operator: "contains", value: "ifood" }],
    categoryId: null,
    personId: null,
    cardId: null,
    accountId: null,
    ...overrides,
  };
}

test("inbox rules match text without case or accent sensitivity", () => {
  const result = resolveInboxRules(item, [
    rule({
      categoryId: "food",
      conditions: [{ field: "originalText", operator: "contains", value: "COMPRA APROVÁDA" }],
    }),
  ]);

  assert.equal(result.categoryId, "food");
  assert.deepEqual(result.appliedRules[0]?.fields, ["categoryId"]);
});

test("inbox rules combine fields from different matching rules", () => {
  const result = resolveInboxRules(item, [
    rule({ id: "person", name: "Nubank", priority: 20, personId: "felipe" }),
    rule({ id: "category", name: "iFood", priority: 10, categoryId: "restaurants" }),
  ]);

  assert.equal(result.categoryId, "restaurants");
  assert.equal(result.personId, "felipe");
  assert.deepEqual(
    result.appliedRules.map((applied) => applied.id),
    ["category", "person"],
  );
});

test("the first matching rule wins independently for each field", () => {
  const result = resolveInboxRules(item, [
    rule({ id: "generic", name: "Genérica", priority: 100, categoryId: "other" }),
    rule({ id: "specific", name: "Específica", priority: 5, categoryId: "restaurants" }),
  ]);

  assert.equal(result.categoryId, "restaurants");
  assert.deepEqual(
    result.appliedRules.map((applied) => applied.id),
    ["specific"],
  );
});

test("all, any and inactive rules are evaluated deterministically", () => {
  const result = resolveInboxRules(item, [
    rule({
      id: "inactive",
      priority: 1,
      isActive: false,
      personId: "inactive-person",
    }),
    rule({
      id: "all-miss",
      priority: 2,
      matchMode: "all",
      conditions: [
        { field: "sourceAppName", operator: "equals", value: "Nubank" },
        { field: "parsedAmount", operator: "greaterThan", value: 100 },
      ],
      personId: "wrong-person",
    }),
    rule({
      id: "any-hit",
      priority: 3,
      matchMode: "any",
      conditions: [
        { field: "sourceAppName", operator: "equals", value: "Outro banco" },
        { field: "parsedAmount", operator: "lessThan", value: 50 },
      ],
      personId: "right-person",
    }),
  ]);

  assert.equal(result.personId, "right-person");
});

test("the first matching rule fills a single payment target, card or account", () => {
  const result = resolveInboxRules(item, [
    rule({ id: "account", name: "Conta", priority: 20, accountId: "checking" }),
    rule({ id: "card", name: "Cartão Samsung", priority: 10, cardId: "samsung" }),
    rule({ id: "category", name: "iFood", priority: 30, categoryId: "restaurants" }),
  ]);

  assert.equal(result.cardId, "samsung");
  assert.equal(result.accountId, null);
  assert.equal(result.categoryId, "restaurants");
  assert.deepEqual(
    result.appliedRules.map((applied) => [applied.id, applied.fields]),
    [
      ["card", ["cardId"]],
      ["category", ["categoryId"]],
    ],
  );
});

test("a rule cannot fill a card and an account at the same time", () => {
  assert.throws(
    () =>
      createInboxRuleDraft({
        userId: "user",
        name: "Pagamento",
        priority: 1,
        isActive: true,
        matchMode: "all",
        conditions: [{ field: "originalText", operator: "contains", value: "samsung" }],
        categoryId: null,
        personId: null,
        cardId: "card",
        accountId: "account",
      }),
    (error) =>
      error instanceof InboxRuleError && error.code === "inbox_rule_payment_target_conflict",
  );
});

test("a rule can fill only the card", () => {
  const draft = createInboxRuleDraft({
    userId: "user",
    name: "Cartão Samsung",
    priority: 1,
    isActive: true,
    matchMode: "all",
    conditions: [{ field: "originalText", operator: "contains", value: "cartão Samsung Itau" }],
    categoryId: null,
    personId: null,
    cardId: "card",
    accountId: null,
  });

  assert.equal(draft.cardId, "card");
});
