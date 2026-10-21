import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpenBillsTotal, isPayable, listRecurringBillOccurrences } from "./bills";
import { paymentMethods } from "./transactions";

test("payables include every non-card expense with a due date and exclude generated postings", () => {
  const bill = {
    type: "expense" as const,
    origin: "regular" as const,
    dueDate: "2026-10-15",
    paymentMethod: "pix" as const,
  };
  for (const paymentMethod of paymentMethods) {
    assert.equal(isPayable({ ...bill, paymentMethod }), paymentMethod !== "credit_card");
  }
  assert.equal(isPayable({ ...bill, dueDate: null }), false);
  assert.equal(isPayable({ ...bill, type: "income" }), false);
  assert.equal(isPayable({ ...bill, type: "transfer" }), false);
  assert.equal(isPayable({ ...bill, origin: "invoicePayment" }), false);
  assert.equal(isPayable({ ...bill, paymentMethod: null }), false);
});

test("weekly occurrences retain their original references without a due date", () => {
  const occurrences = listRecurringBillOccurrences({
    ruleId: "weekly",
    anchorDate: "2026-10-03",
    startDate: "2026-10-03",
    dueDate: null,
    frequency: "weekly",
    period: "2026-10",
  });
  assert.deepEqual(
    occurrences.map((item) => item.dueDate),
    ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"],
  );
  assert.equal(new Set(occurrences.map((item) => item.id)).size, 5);
});

test("open bills total rounds fractional cents after excluding settled bills", () => {
  assert.equal(
    calculateOpenBillsTotal([
      { amount: 0.1, isSettled: false },
      { amount: 0.2, isSettled: false },
      { amount: 99.99, isSettled: true },
    ]),
    0.3,
  );
  assert.equal(calculateOpenBillsTotal([]), 0);
});
