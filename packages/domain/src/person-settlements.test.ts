import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePersonBalance,
  comparePersonBalancePriority,
  hasPersonBalanceActivity,
  type PersonRecurringBalanceRule,
  projectPersonRecurringBalanceAllocations,
  summarizePersonBalances,
} from "./person-settlements";

const rule = {
  id: "spotify-rule",
  seriesId: "spotify-series",
  personId: "admin",
  amount: "-40.90",
  anchorDate: "2026-09-23",
  startDate: "2026-09-23",
  endDate: "2026-09-23",
  configuredEndDate: "2026-09-23",
  frequency: "monthly",
  paymentMethod: "credit_card",
  card: {
    closingDay: 4,
    closingRuleType: "fixedDay",
    closingOffsetDays: null,
    closingOffsetMode: null,
    closingDayPurchasesNextInvoice: true,
    dueDay: 11,
  },
  splits: [
    { personId: "admin", amount: "-13.50" },
    { personId: "camila", amount: "-27.40" },
  ],
} satisfies PersonRecurringBalanceRule;

test("a recurrence ended in September remains assigned to October's invoice", () => {
  assert.deepEqual(
    projectPersonRecurringBalanceAllocations({ period: "2026-10", rules: [rule] }).map(
      ({ occurrenceDate, period, personId, amount }) => ({
        occurrenceDate,
        period,
        personId,
        amount,
      }),
    ),
    [
      { occurrenceDate: "2026-09-23", period: "2026-10", personId: "admin", amount: -13.5 },
      { occurrenceDate: "2026-09-23", period: "2026-10", personId: "camila", amount: -27.4 },
    ],
  );
  assert.deepEqual(
    projectPersonRecurringBalanceAllocations({ period: "2026-09", rules: [rule] }),
    [],
  );
  assert.deepEqual(
    projectPersonRecurringBalanceAllocations({ period: "2026-11", rules: [rule] }),
    [],
  );
});

test("purchases on the closing day follow the card's next-invoice setting", () => {
  for (const nextInvoice of [false, true]) {
    const closingDayRule: PersonRecurringBalanceRule = {
      ...rule,
      anchorDate: "2026-10-04",
      startDate: "2026-10-04",
      endDate: "2026-10-04",
      configuredEndDate: null,
      card: { ...rule.card, closingDayPurchasesNextInvoice: nextInvoice },
    };
    assert.equal(
      projectPersonRecurringBalanceAllocations({ period: "2026-10", rules: [closingDayRule] })
        .length,
      nextInvoice ? 0 : 2,
    );
    assert.equal(
      projectPersonRecurringBalanceAllocations({ period: "2026-11", rules: [closingDayRule] })
        .length,
      nextInvoice ? 2 : 0,
    );
  }
});

test("relative closing rules and year changes retain every weekly allocation once", () => {
  const weeklyRule: PersonRecurringBalanceRule = {
    ...rule,
    anchorDate: "2026-12-18",
    startDate: "2026-12-18",
    endDate: "2027-01-08",
    configuredEndDate: null,
    frequency: "weekly",
    card: {
      ...rule.card,
      closingDay: null,
      closingRuleType: "daysBeforeDue",
      closingOffsetDays: 7,
      closingOffsetMode: "calendarDays",
      dueDay: 5,
    },
  };
  const january = projectPersonRecurringBalanceAllocations({
    period: "2027-01",
    rules: [weeklyRule],
  });
  const february = projectPersonRecurringBalanceAllocations({
    period: "2027-02",
    rules: [weeklyRule],
  });
  assert.deepEqual(
    january
      .filter((allocation) => allocation.personId === "camila")
      .map((allocation) => allocation.occurrenceDate),
    ["2026-12-18", "2026-12-25"],
  );
  assert.deepEqual(
    february
      .filter((allocation) => allocation.personId === "camila")
      .map((allocation) => allocation.occurrenceDate),
    ["2027-01-01", "2027-01-08"],
  );
});

test("non-card recurrence allocations preserve effective amounts and their due month", () => {
  const boleto: PersonRecurringBalanceRule = {
    ...rule,
    paymentMethod: "boleto",
    card: null,
    dueDate: "2026-09-28",
    configuredEndDate: "2026-09-28",
    occurrenceOverrides: {
      "2026-09-23": {
        isSettled: true,
        amount: "-42.00",
        allocations: [
          { personId: "admin", amount: "-14.00", role: "admin" },
          { personId: "camila", amount: "-28.00" },
        ],
      },
    },
  };
  assert.deepEqual(
    projectPersonRecurringBalanceAllocations({ period: "2026-09", rules: [boleto] }).map(
      ({ personId, amount, period }) => ({ personId, amount, period }),
    ),
    [
      { personId: "admin", amount: -14, period: "2026-09" },
      { personId: "camila", amount: -28, period: "2026-09" },
    ],
  );
  assert.deepEqual(
    projectPersonRecurringBalanceAllocations({ period: "2026-10", rules: [boleto] }),
    [],
  );
});

test("covered amount is capped at the amount due net of refunds", () => {
  const partial = calculatePersonBalance([
    { kind: "expense", amount: 4270.8 },
    { kind: "settlement", amount: 1000 },
  ]);
  assert.equal(partial.dueAmount, 4270.8);
  assert.equal(partial.coveredAmount, 1000);

  const overpaid = calculatePersonBalance([
    { kind: "expense", amount: 100 },
    { kind: "refund", amount: 20 },
    { kind: "settlement", amount: 90 },
  ]);
  assert.equal(overpaid.dueAmount, 80);
  assert.equal(overpaid.coveredAmount, 80);
  assert.equal(overpaid.creditAmount, 10);

  const refundedBeyondAssigned = calculatePersonBalance([
    { kind: "expense", amount: 10 },
    { kind: "refund", amount: 30 },
  ]);
  assert.equal(refundedBeyondAssigned.dueAmount, 0);
  assert.equal(refundedBeyondAssigned.coveredAmount, 0);
});

test("summarizes balances including fully settled people", () => {
  const receivable = calculatePersonBalance([
    { kind: "expense", amount: 100.1 },
    { kind: "settlement", amount: 40 },
  ]);
  const settled = calculatePersonBalance([
    { kind: "expense", amount: 50.2 },
    { kind: "settlement", amount: 50.2 },
  ]);
  const credit = calculatePersonBalance([
    { kind: "expense", amount: 10 },
    { kind: "settlement", amount: 15 },
  ]);

  assert.deepEqual(summarizePersonBalances([receivable, settled, credit]), {
    totalReceivableAmount: 60.1,
    totalCreditAmount: 5,
    pendingCount: 1,
  });
  assert.deepEqual([settled, credit, receivable].sort(comparePersonBalancePriority), [
    receivable,
    credit,
    settled,
  ]);
});

test("people without activity in the period are not part of the settlement summary", () => {
  assert.equal(hasPersonBalanceActivity(calculatePersonBalance([])), false);
  assert.equal(
    hasPersonBalanceActivity(
      calculatePersonBalance([
        { kind: "expense", amount: 10 },
        { kind: "settlement", amount: 10 },
      ]),
    ),
    true,
  );
});
