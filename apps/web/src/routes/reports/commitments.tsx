import { createFileRoute } from "@tanstack/react-router";
import {
  resolveCommitmentsSearch,
  validateCommitmentsSearch,
} from "@/features/commitments/commitments.presentation";
import { CommitmentsPage } from "@/features/commitments/components/commitments-page";

export const Route = createFileRoute("/reports/commitments")({
  head: () => ({ meta: [{ title: "Compromissos futuros · OpenMonetis" }] }),
  validateSearch: validateCommitmentsSearch,
  component: CommitmentsRoute,
});

function CommitmentsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CommitmentsPage
      filters={resolveCommitmentsSearch(search)}
      onChange={(filters) => {
        void navigate({ search: { period: undefined, ...filters }, replace: true });
      }}
    />
  );
}
