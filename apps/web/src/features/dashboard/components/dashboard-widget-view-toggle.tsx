import { ChartPie, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardWidgetViewToggle({
  view,
  onToggle,
}: {
  view: "list" | "chart";
  onToggle: () => void;
}) {
  const label = view === "list" ? "Exibir gráfico" : "Exibir lista";
  return (
    <Button
      aria-label={label}
      aria-pressed={view === "chart"}
      onClick={onToggle}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      {view === "list" ? <ChartPie aria-hidden="true" /> : <List aria-hidden="true" />}
    </Button>
  );
}
