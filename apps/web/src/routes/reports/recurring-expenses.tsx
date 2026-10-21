import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateRecurringTransactionsSearch } from "@/features/recurring-transactions/recurring-transactions.presentation";

export const Route = createFileRoute("/reports/recurring-expenses")({
  validateSearch: validateRecurringTransactionsSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/reports/recurring-transactions", search, replace: true });
  },
});
