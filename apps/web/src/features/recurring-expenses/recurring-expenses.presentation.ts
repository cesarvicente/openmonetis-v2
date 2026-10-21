import type { RecurrenceFrequency } from "@openmonetis/domain/transactions";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";

export const recurringFrequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export function formatRecurringExpenseDate(date: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(date), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).replace(/^1 de /, "1º de ");
}

export function formatRecurringExpenseCompactDate(date: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(date), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(".", "");
}
