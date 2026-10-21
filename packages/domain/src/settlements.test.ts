import assert from "node:assert/strict";
import test from "node:test";
import { getOccurrenceAmount, planSettlement, SettlementError } from "./settlements";
import { deriveTransactionPostingDate, deriveTransactionPostingPeriod } from "./transactions";

test("effective settlement preserves sign and allocates rounding cents exactly", () => {
  const plan = planSettlement({
    expectedAmount: -300,
    amount: 299.99,
    date: "2026-10-10",
    today: "2026-10-12",
    allocations: [
      { personId: "a", amount: -100, role: "admin" },
      { personId: "b", amount: -100 },
      { personId: "c", amount: -100 },
    ],
  });
  assert.equal(plan.amount, "-299.99");
  assert.equal(
    plan.allocations.reduce((sum, share) => sum + Math.round(Number(share.amount) * 100), 0),
    -29999,
  );
  const rule = {
    occurrenceOverrides: {
      "2026-10-01": { isSettled: true, amount: plan.amount, allocations: plan.allocations },
    },
  };
  assert.equal(getOccurrenceAmount(rule, "2026-10-01", -300), -299.99);
  assert.equal(getOccurrenceAmount(rule, "2026-11-01", -300), -300);
  assert.equal(
    getOccurrenceAmount(rule, "2026-10-01", -100, "admin"),
    Number(plan.allocations[0].amount),
  );
  assert.equal(
    getOccurrenceAmount(
      { occurrenceOverrides: { "2026-10-01": { isSettled: false, amount: plan.amount } } },
      "2026-10-01",
      -300,
    ),
    -300,
  );
});
test("future dates and invalid actual amounts fail in domain", () => {
  const input = {
    expectedAmount: 100,
    date: "2026-10-13",
    today: "2026-10-12",
    allocations: [{ personId: "a", amount: 100 }],
  };
  assert.throws(() => planSettlement(input), SettlementError);
  for (const amount of [0, -1, Infinity, 0.001, 1.001])
    assert.throws(() => planSettlement({ ...input, date: input.today, amount }), SettlementError);
});
test("cash posting uses effective date for income and expense, legacy dates remain fallback", () => {
  const input = {
    paymentMethod: "pix" as const,
    purchaseDate: "2026-10-01",
    period: "2026-10",
    settledDate: "2026-09-30",
    isSettled: true,
  };
  assert.equal(deriveTransactionPostingDate(input), "2026-09-30");
  assert.equal(deriveTransactionPostingPeriod(input), "2026-09");
  assert.equal(deriveTransactionPostingDate({ ...input, settledDate: null }), "2026-10-01");
  assert.equal(deriveTransactionPostingDate({ ...input, isSettled: false }), null);
});

test("settlements conserve every cent for income and expenses across small and maximum amounts", () => {
  for (const sign of [-1, 1]) {
    for (const amount of [0.01, 0.02, 0.03, 0.99, 1.01, 100.01, 999_999_999.99]) {
      for (const weights of amount < 0.99
        ? [[1]]
        : [[1], [1, 1], [1, 2, 7], [33.33, 33.33, 33.34]]) {
        const allocations = weights.map((weight, index) => ({
          personId: `person-${index}`,
          amount: sign * weight,
        }));
        const before = structuredClone(allocations);
        const plan = planSettlement({
          expectedAmount: sign * 100,
          amount,
          date: "2020-02-29",
          today: "2020-02-29",
          allocations,
        });
        const cents = plan.allocations.map((share) => Math.round(Number(share.amount) * 100));
        assert.equal(
          cents.reduce((sum, value) => sum + value, 0),
          sign * Math.round(amount * 100),
        );
        assert.equal(Number(plan.amount), sign * amount);
        assert.ok(cents.every((value) => sign * value >= 0));
        assert.deepEqual(
          plan.allocations.map((share) => share.personId),
          allocations.map((share) => share.personId),
        );
        assert.deepEqual(allocations, before);
      }
    }
  }
});

test("settlements reject missing allocations, nonfinite amounts and values above the limit", () => {
  const input = {
    expectedAmount: -100,
    date: "2020-01-10",
    today: "2020-01-10",
    allocations: [{ personId: "owner", amount: -100 }],
  };
  assert.throws(() => planSettlement({ ...input, allocations: [] }), {
    code: "INVALID_SETTLEMENT_ALLOCATION",
  });
  for (const amount of [NaN, -Infinity, 1_000_000_000]) {
    assert.throws(() => planSettlement({ ...input, amount }), {
      code: "INVALID_SETTLEMENT_AMOUNT",
    });
  }
});

test("settlement allocation failures use a typed domain error", () => {
  assert.throws(
    () =>
      planSettlement({
        expectedAmount: -10,
        amount: 0.01,
        date: "2020-01-10",
        today: "2020-01-10",
        allocations: [
          { personId: "owner", amount: -5 },
          { personId: "guest", amount: -5 },
        ],
      }),
    { code: "INVALID_SETTLEMENT_ALLOCATION" },
  );
});
