import assert from "node:assert/strict";
import test from "node:test";
import {
  createInboxRuleDraft,
  type InboxRuleCandidate,
  InboxRuleError,
  isInboxRuleApplied,
  matchesInboxDiscardRule,
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
    action: "fill",
    transactionType: null,
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
      transactionType: null,
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
  action: "fill" as const,
  transactionType: null,
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

test("without a typed rule the capture keeps the default expense type", () => {
  const result = resolveInboxRules(item, [
    rule({ id: "category", name: "iFood", categoryId: "restaurants" }),
  ]);

  assert.equal(result.transactionType, null);
  assert.equal(result.categoryId, "restaurants");
});

test("an income rule sets the type and only income categories are filled", () => {
  const result = resolveInboxRules(item, [
    rule({ id: "expense-category", name: "Despesa", priority: 1, categoryId: "restaurants" }),
    rule({
      id: "income",
      name: "Pix recebido",
      priority: 5,
      transactionType: "income",
      categoryId: "salary",
    }),
  ]);

  assert.equal(result.transactionType, "income");
  assert.equal(result.categoryId, "salary");
  assert.deepEqual(
    result.appliedRules.map((applied) => [applied.id, applied.fields]),
    [["income", ["transactionType", "categoryId"]]],
  );
});

test("a rule can fill only the transaction type", () => {
  const draft = createInboxRuleDraft({
    ...draftBase,
    transactionType: "income",
    paymentMethod: null,
    cardId: null,
    accountId: null,
  });
  assert.equal(draft.transactionType, "income");
});

test("any active matching discard rule discards the capture and fills nothing", () => {
  const discard = rule({ id: "discard", name: "Descartar", priority: 500, action: "discard" });
  const fill = rule({ id: "fill", name: "iFood", priority: 1, categoryId: "restaurants" });

  assert.equal(matchesInboxDiscardRule(item, [fill, discard]), true);
  assert.equal(matchesInboxDiscardRule(item, [fill]), false);
  assert.equal(matchesInboxDiscardRule(item, [{ ...discard, isActive: false }]), false);
  assert.equal(
    matchesInboxDiscardRule(item, [
      rule({
        action: "discard",
        conditions: [{ field: "originalText", operator: "contains", value: "uber" }],
      }),
    ]),
    false,
  );

  const result = resolveInboxRules(item, [discard, fill]);
  assert.deepEqual(
    result.appliedRules.map((applied) => applied.id),
    ["fill"],
  );
  assert.equal(isInboxRuleApplied(item, [discard, fill], "discard"), true);
  assert.equal(isInboxRuleApplied(item, [discard, fill], "fill"), true);
});

test("a discard rule needs conditions but cannot fill fields", () => {
  const discard = {
    ...draftBase,
    action: "discard" as const,
    paymentMethod: null,
    cardId: null,
    accountId: null,
  };
  assert.equal(createInboxRuleDraft(discard).action, "discard");
  assert.throws(
    () => createInboxRuleDraft({ ...discard, categoryId: "restaurants" }),
    (error) => error instanceof InboxRuleError && error.code === "inbox_rule_discard_with_fields",
  );
  assert.throws(
    () => createInboxRuleDraft({ ...discard, conditions: [] }),
    (error) => error instanceof InboxRuleError && error.code === "inbox_rule_conditions_required",
  );
});
