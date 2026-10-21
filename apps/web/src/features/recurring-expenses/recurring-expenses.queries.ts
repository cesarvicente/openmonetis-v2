import { queryOptions } from "@tanstack/react-query";
import { getRecurringExpenses } from "./recurring-expenses.api";

const recurringExpenseKeys = {
  all: ["recurring-expenses"] as const,
  period: (period: string) => [...recurringExpenseKeys.all, period] as const,
};

export function recurringExpensesQueryOptions(period: string) {
  return queryOptions({
    queryKey: recurringExpenseKeys.period(period),
    queryFn: () => getRecurringExpenses(period),
  });
}
