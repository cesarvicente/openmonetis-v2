import assert from "node:assert/strict";
import test from "node:test";
import {
  getTagNameKey,
  matchesTransactionTags,
  summarizeTags,
  type TaggedFinancialEntry,
} from "./tags";

test("tag names normalize whitespace and case without collapsing accents", () => {
  assert.equal(getTagNameKey("  VIAGEM   Japão  "), "viagem japão");
  assert.notEqual(getTagNameKey("Avó"), getTagNameKey("Avo"));
});
test("multiple selected tags match a transaction once with union semantics", () => {
  assert.equal(matchesTransactionTags(["a", "b"], ["a", "b"]), true);
  assert.equal(matchesTransactionTags(["a"], ["c"]), false);
  assert.equal(matchesTransactionTags([], []), true);
});
test("untagged filtering only matches entries without associations", () => {
  assert.equal(matchesTransactionTags([], [], true), true);
  assert.equal(matchesTransactionTags(["a"], [], true), false);
  assert.equal(matchesTransactionTags(["a"], ["a"], true), false);
});
test("tag totals respect allocations, refunds, neutral movements and duplicate entries", () => {
  const entries: TaggedFinancialEntry[] = [
    {
      id: "expense:a",
      type: "expense",
      origin: "regular",
      amount: -100,
      allocation: { amount: -60 },
      tagIds: ["a", "b"],
    },
    {
      id: "expense:b",
      type: "expense",
      origin: "regular",
      amount: -100,
      allocation: { amount: -40 },
      tagIds: ["a", "b"],
    },
    { id: "income", type: "income", origin: "regular", amount: 200, tagIds: ["a"] },
    { id: "refund", type: "income", origin: "refund", amount: 25, tagIds: ["a", "b"] },
    { id: "transfer", type: "transfer", origin: "regular", amount: 500, tagIds: ["a"] },
    { id: "invoice", type: "expense", origin: "invoicePayment", amount: -100, tagIds: ["a"] },
    {
      id: "adjustment",
      type: "income",
      origin: "accountBalanceAdjustment",
      amount: 300,
      tagIds: ["a"],
    },
  ];
  assert.deepEqual(summarizeTags(["a", "b", "empty"], [...entries, entries[0]]), [
    { tagId: "a", income: 200, expenses: 75, balance: 125 },
    { tagId: "b", income: 0, expenses: 75, balance: -75 },
    { tagId: "empty", income: 0, expenses: 0, balance: 0 },
  ]);
});
test("tag totals sum monetary cents exactly", () => {
  const entries = [0.1, 0.2].map(
    (amount, i): TaggedFinancialEntry => ({
      id: String(i),
      type: "expense",
      origin: "regular",
      amount: -amount,
      tagIds: ["a", "a"],
    }),
  );
  assert.equal(summarizeTags(["a"], entries)[0].expenses, 0.3);
});
