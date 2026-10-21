import type { UpdateRecurringExpenseInput } from "@openmonetis/validators/recurring-expenses";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { updateRecurringExpense } from "./recurring-expenses.api";

export function useUpdateRecurringExpenseMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      id: string;
      purchaseDate: string;
      input: UpdateRecurringExpenseInput;
    }) => updateRecurringExpense(variables.id, variables.purchaseDate, variables.input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
