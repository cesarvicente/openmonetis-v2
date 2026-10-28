import { createFileRoute } from "@tanstack/react-router";
import { FinancialDistributionPage } from "@/features/financial-distribution/components/financial-distribution-page";
import {
  resolveFinancialDistributionSearch,
  validateFinancialDistributionSearch,
} from "@/features/financial-distribution/financial-distribution.presentation";

export const Route = createFileRoute("/reports/financial-distribution")({
  head: () => ({ meta: [{ title: "Distribuição financeira · OpenMonetis" }] }),
  validateSearch: validateFinancialDistributionSearch,
  component: FinancialDistributionRoute,
});

function FinancialDistributionRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <FinancialDistributionPage
      filters={resolveFinancialDistributionSearch(search)}
      onChange={(filters) => {
        void navigate({ search: filters, replace: true });
      }}
    />
  );
}
