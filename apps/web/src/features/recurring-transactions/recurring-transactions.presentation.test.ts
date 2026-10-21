import assert from "node:assert/strict";
import test from "node:test";
import { validateRecurringTransactionsSearch } from "./recurring-transactions.presentation";

test("recurring report URLs retain income tab, month and list filters", () => {
  assert.deepEqual(
    validateRecurringTransactionsSearch({
      type: "income",
      period: "2026-10",
      status: "ended",
      paymentMethod: "pix",
      q: "Salário",
    }),
    {
      type: "income",
      period: "2026-10",
      status: "ended",
      paymentMethod: "pix",
      q: "Salário",
    },
  );
});
test("invalid or missing recurring report URL filters use usable defaults", () => {
  assert.deepEqual(
    validateRecurringTransactionsSearch({
      type: "transfer",
      period: "2026-99",
      status: "deleted",
      paymentMethod: "invalid",
      q: ["wrong"],
    }),
    {
      type: "expense",
      period: undefined,
      status: "active",
      paymentMethod: "all",
      q: "",
    },
  );
});
