import { createFileRoute } from "@tanstack/react-router";
import { RecurringTransactionsReportPage } from "@/features/recurring-transactions/components/recurring-transactions-report-page";
import { validateRecurringTransactionsSearch } from "@/features/recurring-transactions/recurring-transactions.presentation";

export const Route = createFileRoute("/reports/recurring-transactions")({
  head: () => ({ meta: [{ title: "Lançamentos recorrentes · OpenMonetis" }] }),
  component: RecurringTransactionsReportRoute,
  validateSearch: validateRecurringTransactionsSearch,
});
function RecurringTransactionsReportRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RecurringTransactionsReportPage
      search={search}
      onSearchChange={(patch) =>
        void navigate({ replace: true, search: (previous) => ({ ...previous, ...patch }) })
      }
    />
  );
}
