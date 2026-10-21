import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import {
  type RecurringTransactionsSearch,
  RecurringTransactionsSearchSchema,
} from "@openmonetis/validators/recurring-transactions";
export const recurringStatusLabels = {
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
} as const;
export function validateRecurringTransactionsSearch(
  search: Record<string, unknown>,
): RecurringTransactionsSearch {
  return RecurringTransactionsSearchSchema.parse(search);
}
export function resolveRecurringTransactionsPeriod(search: RecurringTransactionsSearch) {
  return search.period ?? getCurrentPeriodInBrazil();
}
