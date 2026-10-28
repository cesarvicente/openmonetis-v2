import {
  type CategoryTrendActualEntry,
  type CategoryTrendCategory,
  type CategoryTrendCategoryOutput,
  type CategoryTrendRecurringRule,
  calculateCategoryTrends,
} from "./category-trends";
import { addMonthsToPeriod } from "./transactions";

export const uncategorizedIncomeKey = "uncategorized-income";
export const uncategorizedExpenseKey = "uncategorized-expense";

export type FinancialDistributionCategory = {
  key: string;
  categoryId: string | null;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  amount: number;
  percentage: number | null;
  children: Omit<FinancialDistributionCategory, "children">[];
  directAmount: number;
};

export type FinancialDistributionFlow = {
  key: string;
  categoryId: string | null;
  name: string;
  kind: "income" | "expense" | "refund" | "surplus" | "deficit";
  amount: number;
  percentage: number;
  /** True when the flow aggregates the smallest categories of its side. */
  grouped: boolean;
};

export const maxDistributionFlowsPerSide = 12;
export const otherIncomeKey = "other-income";
export const otherExpenseKey = "other-expense";

export function calculateFinancialDistribution(input: {
  period: string;
  mode: "actual" | "forecast";
  categories: readonly CategoryTrendCategory[];
  actualEntries: readonly CategoryTrendActualEntry[];
  recurringRules: readonly CategoryTrendRecurringRule[];
}) {
  const report = calculateCategoryTrends({
    startPeriod: input.period,
    endPeriod: input.period,
    categories: [
      ...input.categories,
      { categoryId: uncategorizedIncomeKey, name: "", icon: null, type: "income" },
      { categoryId: uncategorizedExpenseKey, name: "", icon: null, type: "expense" },
    ],
    actualEntries: input.actualEntries,
    recurringRules: input.recurringRules,
    recurringOccurrenceScope: input.mode === "actual" ? "settled" : "all",
    excludeHiddenAccounts: true,
  });
  const sumCents = (type: "income" | "expense") =>
    report.categories
      .filter((category) => category.type === type)
      .reduce((sum, category) => sum + cents(category.totalAmount), 0);
  const incomeCents = sumCents("income");
  const expenseCents = sumCents("expense");
  const balanceCents = incomeCents - expenseCents;
  const refundCents = report.categories
    .filter((category) => category.type === "expense" && category.totalAmount < 0)
    .reduce((sum, category) => sum - cents(category.totalAmount), 0);
  const deficitCents = Math.max(0, -balanceCents);
  const flowCents = incomeCents + refundCents + deficitCents;
  const categories = report.categories
    .filter(
      (category) =>
        category.totalAmount !== 0 ||
        category.subcategories?.some((child) => child.totalAmount !== 0),
    )
    .map((category) =>
      categoryOutput(category, category.type === "income" ? incomeCents : expenseCents),
    );
  const sources: FinancialDistributionFlow[] = [];
  const destinations: FinancialDistributionFlow[] = [];
  for (const category of categories) {
    if (category.amount === 0) continue;
    const flow: FinancialDistributionFlow = {
      key: category.key,
      categoryId: category.categoryId,
      name: category.name,
      kind: category.type === "income" ? "income" : category.amount < 0 ? "refund" : "expense",
      amount: Math.abs(category.amount),
      percentage: percentage(Math.abs(cents(category.amount)), flowCents) ?? 0,
      grouped: false,
    };
    if (flow.kind === "expense") destinations.push(flow);
    else sources.push(flow);
  }
  if (deficitCents > 0) {
    sources.push({
      key: "deficit",
      categoryId: null,
      name: "",
      kind: "deficit",
      amount: deficitCents / 100,
      percentage: percentage(deficitCents, flowCents) ?? 0,
      grouped: false,
    });
  }
  if (balanceCents > 0) {
    destinations.push({
      key: "surplus",
      categoryId: null,
      name: "",
      kind: "surplus",
      amount: balanceCents / 100,
      percentage: percentage(balanceCents, flowCents) ?? 0,
      grouped: false,
    });
  }
  const chartSources = groupSmallestFlows(sources, "income", otherIncomeKey, flowCents);
  const chartDestinations = groupSmallestFlows(destinations, "expense", otherExpenseKey, flowCents);
  const leadingExpenses = categories
    .filter((category) => category.type === "expense" && category.amount > 0)
    .slice(0, 2);
  const leadingCents = leadingExpenses.reduce((sum, category) => sum + cents(category.amount), 0);
  return {
    period: input.period,
    mode: input.mode,
    incomeAmount: incomeCents / 100,
    expenseAmount: expenseCents / 100,
    balanceAmount: balanceCents / 100,
    flowAmount: flowCents / 100,
    categories,
    sources: chartSources,
    destinations: chartDestinations,
    leadingExpensesAmount: leadingCents / 100,
    leadingExpensesPercentage: percentage(leadingCents, expenseCents),
  };
}

/**
 * Keeps the largest flows of one kind and folds the remaining ones into a single
 * "other" flow, so the Sankey stays legible. Flows of other kinds are untouched.
 */
function groupSmallestFlows(
  flows: FinancialDistributionFlow[],
  kind: "income" | "expense",
  otherKey: string,
  flowCents: number,
) {
  const candidates = flows.filter((flow) => flow.kind === kind);
  if (candidates.length <= maxDistributionFlowsPerSide) return flows;
  const kept = new Set(
    [...candidates]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, maxDistributionFlowsPerSide - 1)
      .map((flow) => flow.key),
  );
  const otherCents = candidates
    .filter((flow) => !kept.has(flow.key))
    .reduce((sum, flow) => sum + cents(flow.amount), 0);
  return [
    ...flows.filter((flow) => flow.kind !== kind || kept.has(flow.key)),
    {
      key: otherKey,
      categoryId: null,
      name: "",
      kind,
      amount: otherCents / 100,
      percentage: percentage(otherCents, flowCents) ?? 0,
      grouped: true,
    },
  ];
}

export type FinancialDistributionTotals = {
  incomeAmount: number;
  expenseAmount: number;
  balanceAmount: number;
};

export function getPreviousDistributionPeriod(period: string) {
  return addMonthsToPeriod(period, -1);
}

/**
 * Derives the savings rate and the month-over-month comparison from two already
 * calculated distributions. Percentages are null when there is no positive base.
 */
export function compareFinancialDistribution(
  current: FinancialDistributionTotals,
  previous: FinancialDistributionTotals & { period: string },
) {
  return {
    savingsRatePercentage: signedPercentage(
      cents(current.balanceAmount),
      cents(current.incomeAmount),
    ),
    comparison: {
      previousPeriod: previous.period,
      previousIncomeAmount: previous.incomeAmount,
      previousExpenseAmount: previous.expenseAmount,
      previousBalanceAmount: previous.balanceAmount,
      incomeChangePercentage: changePercentage(current.incomeAmount, previous.incomeAmount),
      expenseChangePercentage: changePercentage(current.expenseAmount, previous.expenseAmount),
    },
  };
}

function changePercentage(current: number, previous: number) {
  return signedPercentage(cents(current) - cents(previous), cents(previous));
}

function signedPercentage(value: number, base: number) {
  return base > 0 ? Math.round((value / base) * 10_000) / 100 : null;
}

function categoryOutput(
  category: CategoryTrendCategoryOutput,
  totalCents: number,
): FinancialDistributionCategory {
  return {
    key: category.categoryId,
    categoryId: [uncategorizedIncomeKey, uncategorizedExpenseKey].includes(category.categoryId)
      ? null
      : category.categoryId,
    name: category.name,
    icon: category.icon,
    type: category.type,
    amount: category.totalAmount,
    percentage: percentage(cents(category.totalAmount), totalCents),
    directAmount: category.directCategory?.totalAmount ?? category.totalAmount,
    children: (category.subcategories ?? [])
      .filter((child) => child.totalAmount !== 0)
      .map((child) => {
        const { children: _children, ...detail } = categoryOutput(child, totalCents);
        return detail;
      }),
  };
}

function cents(value: number) {
  return Math.round(value * 100);
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10_000) / 100 : null;
}
