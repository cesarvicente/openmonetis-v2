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
    paymentMethod: null,
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

test("the first matching rule fills the payment method with its card or account", () => {
  const result = resolveInboxRules(item, [
    rule({
      id: "account",
      name: "Conta",
      priority: 20,
      paymentMethod: "pix",
      accountId: "checking",
    }),
    rule({
      id: "card",
      name: "Cartão Samsung",
      priority: 10,
      paymentMethod: "credit_card",
      cardId: "samsung",
    }),
    rule({ id: "category", name: "iFood", priority: 30, categoryId: "restaurants" }),
  ]);

  assert.equal(result.paymentMethod, "credit_card");
  assert.equal(result.cardId, "samsung");
  assert.equal(result.accountId, null);
  assert.equal(result.categoryId, "restaurants");
  assert.deepEqual(
    result.appliedRules.map((applied) => [applied.id, applied.fields]),
    [
      ["card", ["paymentMethod", "cardId"]],
      ["category", ["categoryId"]],
    ],
  );
});

const draftBase = {
  userId: "user",
  name: "Pagamento",
  priority: 1,
  isActive: true,
  matchMode: "all" as const,
  conditions: [{ field: "originalText" as const, operator: "contains" as const, value: "samsung" }],
  categoryId: null,
  personId: null,
};

test("a card only fits credit card rules and an account only the other methods", () => {
  for (const target of [
    { paymentMethod: "credit_card" as const, cardId: null, accountId: "account" },
    { paymentMethod: "pix" as const, cardId: "card", accountId: null },
    { paymentMethod: null, cardId: "card", accountId: null },
    { paymentMethod: null, cardId: null, accountId: "account" },
  ]) {
    assert.throws(
      () => createInboxRuleDraft({ ...draftBase, ...target }),
      (error) =>
        error instanceof InboxRuleError && error.code === "inbox_rule_invalid_payment_target",
    );
  }
});

test("a rule can fill only the payment method and its card or account", () => {
  assert.equal(
    createInboxRuleDraft({
      ...draftBase,
      paymentMethod: "credit_card",
      cardId: "card",
      accountId: null,
    }).cardId,
    "card",
  );
  assert.equal(
    createInboxRuleDraft({
      ...draftBase,
      paymentMethod: "debit_card",
      cardId: null,
      accountId: "account",
    }).accountId,
    "account",
  );
});

test("a rule can fill the payment method without a card or account", () => {
  const draft = createInboxRuleDraft({
    ...draftBase,
    paymentMethod: "credit_card",
    cardId: null,
    accountId: null,
  });
  assert.equal(draft.paymentMethod, "credit_card");

  const result = resolveInboxRules(item, [
    rule({ id: "method", name: "Crédito", paymentMethod: "credit_card" }),
  ]);
  assert.equal(result.paymentMethod, "credit_card");
  assert.equal(result.cardId, null);
  assert.deepEqual(result.appliedRules[0]?.fields, ["paymentMethod"]);
});
