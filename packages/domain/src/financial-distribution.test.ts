import assert from "node:assert/strict";
import test from "node:test";
import type {
  CategoryTrendActualEntry,
  CategoryTrendCategory,
  CategoryTrendRecurringRule,
} from "./category-trends";
import {
  calculateFinancialDistribution,
  compareFinancialDistribution,
  getPreviousDistributionPeriod,
  uncategorizedExpenseKey,
  uncategorizedIncomeKey,
} from "./financial-distribution";

const incomeId = "10000000-0000-4000-8000-000000000001";
const expenseId = "20000000-0000-4000-8000-000000000002";
const childId = "30000000-0000-4000-8000-000000000003";
const adjustmentId = "40000000-0000-4000-8000-000000000004";
const categories: CategoryTrendCategory[] = [
  { categoryId: incomeId, name: "Salary", icon: null, type: "income" },
  { categoryId: expenseId, name: "Home", icon: null, type: "expense" },
  { categoryId: childId, parentId: expenseId, name: "Rent", icon: null, type: "expense" },
  { categoryId: adjustmentId, name: "Adjustments", icon: null, type: "expense" },
];
function entry(
  categoryId: string,
  amount: number,
  type: "income" | "expense" = "expense",
  origin: CategoryTrendActualEntry["origin"] = "regular",
  transactionType = type,
): CategoryTrendActualEntry {
  return { categoryId, amount, type, transactionType, origin, period: "2026-10" };
}
const recurring: CategoryTrendRecurringRule = {
  categoryId: childId,
  type: "expense",
  amount: "100",
  anchorDate: "2026-10-01",
  startDate: "2026-10-01",
  frequency: "monthly",
  paymentMethod: "pix",
  dueDate: null,
  status: "active",
  card: null,
};
function calculate(
  actualEntries: CategoryTrendActualEntry[],
  mode: "actual" | "forecast" = "actual",
  recurringRules: CategoryTrendRecurringRule[] = [],
) {
  return calculateFinancialDistribution({
    period: "2026-10",
    mode,
    categories,
    actualEntries,
    recurringRules,
  });
}
function assertBalanced(report: ReturnType<typeof calculate>) {
  const sum = (flows: typeof report.sources) =>
    flows.reduce((total, flow) => total + Math.round(flow.amount * 100), 0);
  assert.equal(sum(report.sources), Math.round(report.flowAmount * 100));
  assert.equal(sum(report.destinations), Math.round(report.flowAmount * 100));
  assert.ok([...report.sources, ...report.destinations].every((flow) => flow.amount > 0));
}

test("distribution aggregates children once, respects cents, excludes transfers, invoice payments and balance adjustments", () => {
  const report = calculate([
    entry(incomeId, 1000, "income"),
    entry(expenseId, 100.1),
    entry(childId, 200.2),
    entry(childId, 20.05, "expense", "refund", "income"),
    entry(expenseId, 900, "expense", "invoicePayment"),
    entry(incomeId, 300, "income", "accountBalanceAdjustment"),
    { ...entry(expenseId, 999), transactionType: "transfer" },
    { ...entry(incomeId, 999, "income"), transactionType: "transfer" },
    { ...entry(expenseId, 999), period: "2026-09" },
  ]);
  assert.equal(report.incomeAmount, 1000);
  assert.equal(report.expenseAmount, 280.25);
  assert.equal(report.balanceAmount, 719.75);
  const home = report.categories.find((category) => category.key === expenseId);
  assert.equal(home?.amount, 280.25);
  assert.equal(home?.directAmount, 100.1);
  assert.equal(home?.children[0]?.amount, 180.15);
  assert.equal(report.destinations.find((flow) => flow.kind === "expense")?.percentage, 28.03);
  assertBalanced(report);
});

test("settled recurring occurrences use effective allocations in actual mode and unconfirmed occurrences only enter forecast", () => {
  const rule = {
    ...recurring,
    allocationPersonId: "owner",
    occurrenceOverrides: {
      "2026-10-01": {
        isSettled: true,
        amount: "80",
        allocations: [
          { personId: "owner", amount: "30" },
          { personId: "other", amount: "50" },
        ],
      },
    },
  };
  assert.equal(calculate([], "actual", [recurring]).expenseAmount, 0);
  assert.equal(calculate([], "forecast", [recurring]).expenseAmount, 100);
  assert.equal(calculate([], "actual", [rule]).expenseAmount, 30);
  assert.equal(calculate([], "forecast", [rule]).expenseAmount, 30);
  assert.equal(calculate([], "actual", [{ ...recurring, isSettled: true }]).expenseAmount, 100);
  assert.equal(
    calculate([], "actual", [
      { ...rule, occurrenceOverrides: { "2026-10-01": { isSettled: false } } },
    ]).expenseAmount,
    0,
  );
});

test("deficits and excess refunds conserve positive Sankey flows without manufacturing income", () => {
  for (const income of [0, 1.23, 80, 200]) {
    for (const expense of [0, 30.05, 200]) {
      for (const refund of [0, 10.01, 300]) {
        const report = calculate([
          entry(incomeId, income, "income"),
          entry(expenseId, expense),
          entry(adjustmentId, refund, "expense", "refund", "income"),
        ]);
        assert.equal(report.incomeAmount, income);
        assert.equal(
          Math.round(report.balanceAmount * 100),
          Math.round(income * 100) - Math.round(expense * 100) + Math.round(refund * 100),
        );
        assertBalanced(report);
        assert.equal(
          report.sources.some((flow) => flow.kind === "deficit"),
          report.balanceAmount < 0,
        );
        assert.equal(
          report.destinations.some((flow) => flow.kind === "surplus"),
          report.balanceAmount > 0,
        );
      }
    }
  }
});

test("uncategorized income and expense stay separate and empty reports avoid division by zero", () => {
  const report = calculate([
    entry(uncategorizedIncomeKey, 50, "income"),
    entry(uncategorizedExpenseKey, 20),
  ]);
  assert.equal(report.categories.length, 2);
  assert.ok(report.categories.every((category) => category.categoryId === null));
  assert.equal(report.balanceAmount, 30);
  assertBalanced(report);
  const empty = calculate([]);
  assert.deepEqual(empty.sources, []);
  assert.deepEqual(empty.destinations, []);
  assert.equal(empty.leadingExpensesPercentage, null);
  assertBalanced(empty);
});

test("hidden accounts never contribute income, expenses, forecasts, categories or flow percentages", () => {
  for (const mode of ["actual", "forecast"] as const) {
    const report = calculate(
      [
        entry(incomeId, 100, "income"),
        entry(expenseId, 20),
        { ...entry(incomeId, 900, "income"), excludeFromBalance: true },
        { ...entry(childId, 300), excludeFromBalance: true },
      ],
      mode,
      [
        { ...recurring, excludeFromBalance: true, isSettled: true },
        { ...recurring, type: "income", categoryId: incomeId, excludeFromBalance: true },
      ],
    );
    assert.equal(report.incomeAmount, 100);
    assert.equal(report.expenseAmount, 20);
    assert.equal(report.balanceAmount, 80);
    assert.equal(
      report.categories.find((category) => category.key === expenseId)?.children.length,
      0,
    );
    assert.equal(report.destinations.find((flow) => flow.kind === "expense")?.percentage, 20);
    assertBalanced(report);
  }
});

test("confirmed recurrence visibility follows its settlement account, including a visible override of a hidden series", () => {
  for (const mode of ["actual", "forecast"] as const) {
    const confirmed = {
      ...recurring,
      occurrenceOverrides: { "2026-10-01": { isSettled: true, amount: "80" } },
    };
    const hiddenSettlement = calculate([], mode, [
      {
        ...confirmed,
        excludeFromBalance: false,
        occurrenceAccountExclusions: { "2026-10-01": true },
      },
    ]);
    assert.equal(hiddenSettlement.expenseAmount, 0);
    const visibleSettlement = calculate([], mode, [
      {
        ...confirmed,
        excludeFromBalance: true,
        occurrenceAccountExclusions: { "2026-10-01": false },
      },
    ]);
    assert.equal(visibleSettlement.expenseAmount, 80);
    assertBalanced(visibleSettlement);
  }
});

test("savings rate and month-over-month changes use cents and null for empty bases", () => {
  const comparison = compareFinancialDistribution(
    { incomeAmount: 1000, expenseAmount: 750.5, balanceAmount: 249.5 },
    { period: "2026-09", incomeAmount: 0, expenseAmount: 500.25, balanceAmount: -500.25 },
  );
  assert.equal(comparison.savingsRatePercentage, 24.95);
  assert.equal(comparison.comparison.previousPeriod, "2026-09");
  assert.equal(comparison.comparison.incomeChangePercentage, null);
  assert.equal(comparison.comparison.expenseChangePercentage, 50.02);
  assert.equal(
    compareFinancialDistribution(
      { incomeAmount: 0, expenseAmount: 10, balanceAmount: -10 },
      { period: "2026-09", incomeAmount: 0, expenseAmount: 0, balanceAmount: 0 },
    ).savingsRatePercentage,
    null,
  );
  assert.equal(getPreviousDistributionPeriod("2026-01"), "2025-12");
});

test("flows beyond the per-side limit are folded into one grouped flow that conserves totals", () => {
  const ids = Array.from(
    { length: 15 },
    (_, index) => `5000000${index.toString(16)}-0000-4000-8000-000000000005`,
  );
  const report = calculateFinancialDistribution({
    period: "2026-10",
    mode: "actual",
    categories: ids.map((categoryId, index) => ({
      categoryId,
      name: `Expense ${index}`,
      icon: null,
      type: "expense" as const,
    })),
    actualEntries: ids.map((categoryId, index) => entry(categoryId, (index + 1) * 10)),
    recurringRules: [],
  });
  assert.equal(report.destinations.filter((flow) => flow.grouped).length, 1);
  assert.equal(report.destinations.length, 12);
  assert.equal(report.categories.length, 15);
  const cents = (value: number) => Math.round(value * 100);
  assert.equal(
    report.destinations.reduce((total, flow) => total + cents(flow.amount), 0),
    cents(report.expenseAmount),
  );
});
