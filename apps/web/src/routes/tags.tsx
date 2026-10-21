import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import { createFileRoute } from "@tanstack/react-router";
import { TagsPage } from "@/features/tags/components/tags-page";
export const Route = createFileRoute("/tags")({
  head: () => ({ meta: [{ title: "Etiquetas · OpenMonetis" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    period:
      typeof search.period === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(search.period)
        ? search.period
        : undefined,
  }),
  component: TagsRoute,
});

function TagsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <TagsPage
      period={search.period ?? getCurrentPeriodInBrazil()}
      onPeriodChange={(period) => void navigate({ replace: true, search: { period } })}
    />
  );
}
