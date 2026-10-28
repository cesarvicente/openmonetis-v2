import assert from "node:assert/strict";
import test from "node:test";
import { FinancialDistributionOutputSchema } from "@openmonetis/validators/financial-distribution";
import {
  distributionFlowLabel,
  financialDistributionCsv,
  resolveFinancialDistributionSearch,
  validateFinancialDistributionSearch,
} from "./financial-distribution.presentation";

test("distribution search sanitizes invalid parameters and preserves valid monthly scope", () => {
  assert.deepEqual(
    validateFinancialDistributionSearch({
      period: "2026-13",
      personScope: "invalid",
      mode: "paid",
    }),
    { period: undefined, personScope: "admin", mode: "actual" },
  );
  const query = { period: "2026-10", personScope: "all", mode: "forecast" };
  assert.deepEqual(
    resolveFinancialDistributionSearch(validateFinancialDistributionSearch(query)),
    query,
  );
});

test("distribution export uses the selected composition, escapes category names and identifies subtotal rows", () => {
  const report = FinancialDistributionOutputSchema.parse({
    period: "2026-10",
    mode: "actual",
    incomeAmount: 0,
    expenseAmount: 10.05,
    balanceAmount: -10.05,
    flowAmount: 10.05,
    categories: [
      {
        key: "uncategorized-expense",
        categoryId: null,
        name: "",
        icon: null,
        type: "expense",
        amount: 10.05,
        percentage: 100,
        directAmount: 10.05,
        children: [],
      },
    ],
    sources: [],
    destinations: [],
    leadingExpensesAmount: 10.05,
    leadingExpensesPercentage: 100,
    savingsRatePercentage: null,
    comparison: {
      previousPeriod: "2026-09",
      previousIncomeAmount: 0,
      previousExpenseAmount: 0,
      previousBalanceAmount: 0,
      incomeChangePercentage: null,
      expenseChangePercentage: null,
    },
  });
  const csv = financialDistributionCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Lançados";"Despesa";"Sem categoria";"Total da categoria";"10,05"/);
  assert.match(csv, /"Saldo do período";"";"";"-10,05"/);
  report.categories[0].categoryId = "10000000-0000-4000-8000-000000000001";
  report.categories[0].name = 'Home; "Rent"';
  assert.match(financialDistributionCsv(report), /"Home; ""Rent"""/);
  report.categories[0].name = '=HYPERLINK("https://example.test")';
  assert.match(financialDistributionCsv(report), /"'=HYPERLINK/);
});

test("flow labels distinguish surplus, deficit, uncategorized flows and expense reductions", () => {
  const flow = {
    key: "surplus",
    categoryId: null,
    name: "",
    kind: "surplus" as const,
    amount: 10,
    percentage: 100,
    grouped: false,
  };
  assert.equal(distributionFlowLabel(flow), "Saldo do período");
  assert.equal(distributionFlowLabel({ ...flow, kind: "deficit" }), "Déficit do período");
  assert.equal(
    distributionFlowLabel({ ...flow, kind: "refund" }),
    "Estornos e ajustes · Sem categoria",
  );
  assert.equal(
    distributionFlowLabel({ ...flow, kind: "expense", grouped: true }),
    "Outras categorias",
  );
});
