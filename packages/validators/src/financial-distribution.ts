import { z } from "@hono/zod-openapi";

export const ListFinancialDistributionQuerySchema = z
  .object({
    period: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
    personScope: z.union([z.enum(["admin", "all"]), z.uuid()]).default("admin"),
    mode: z.enum(["actual", "forecast"]).default("actual"),
  })
  .openapi("ListFinancialDistributionQuery");

const categoryFields = {
  key: z.string(),
  categoryId: z.uuid().nullable(),
  name: z.string(),
  icon: z.string().nullable(),
  type: z.enum(["income", "expense"]),
  amount: z.number(),
  percentage: z.number().nullable(),
  directAmount: z.number(),
};
const CategorySchema = z.object({
  ...categoryFields,
  children: z.array(z.object(categoryFields)),
});

const FlowSchema = z.object({
  key: z.string(),
  categoryId: z.uuid().nullable(),
  name: z.string(),
  kind: z.enum(["income", "expense", "refund", "surplus", "deficit"]),
  amount: z.number().positive(),
  percentage: z.number().nonnegative(),
  grouped: z.boolean(),
});

const ComparisonSchema = z.object({
  previousPeriod: ListFinancialDistributionQuerySchema.shape.period,
  previousIncomeAmount: z.number().nonnegative(),
  previousExpenseAmount: z.number(),
  previousBalanceAmount: z.number(),
  incomeChangePercentage: z.number().nullable(),
  expenseChangePercentage: z.number().nullable(),
});

export const FinancialDistributionOutputSchema = z
  .object({
    period: ListFinancialDistributionQuerySchema.shape.period,
    mode: z.enum(["actual", "forecast"]),
    incomeAmount: z.number().nonnegative(),
    expenseAmount: z.number(),
    balanceAmount: z.number(),
    flowAmount: z.number().nonnegative(),
    categories: z.array(CategorySchema),
    sources: z.array(FlowSchema),
    destinations: z.array(FlowSchema),
    leadingExpensesAmount: z.number().nonnegative(),
    leadingExpensesPercentage: z.number().nullable(),
    savingsRatePercentage: z.number().nullable(),
    comparison: ComparisonSchema,
  })
  .openapi("FinancialDistribution");

export type ListFinancialDistributionQuery = z.infer<typeof ListFinancialDistributionQuerySchema>;
export type FinancialDistributionOutput = z.infer<typeof FinancialDistributionOutputSchema>;
