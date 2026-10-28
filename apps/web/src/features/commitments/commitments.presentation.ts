import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import {
  type CommitmentsOutput,
  commitmentPeriodSchema,
  defaultCommitmentMonths,
  type ListCommitmentsQuery,
  ListCommitmentsQuerySchema,
} from "@openmonetis/validators/commitments";

type CommitmentStatus = CommitmentsOutput["months"][number]["status"];

export function validateCommitmentsSearch(search: Record<string, unknown>) {
  return {
    // `period` é o parâmetro legado (início do horizonte), ainda usado pela navegação entre relatórios.
    period: commitmentPeriodSchema.safeParse(search.period).data,
    startPeriod: commitmentPeriodSchema.safeParse(search.startPeriod).data,
    endPeriod: commitmentPeriodSchema.safeParse(search.endPeriod).data,
  };
}

export function resolveCommitmentsSearch(
  search: ReturnType<typeof validateCommitmentsSearch>,
): ListCommitmentsQuery {
  const range = ListCommitmentsQuerySchema.safeParse(search);
  if (range.success) return range.data;
  const startPeriod = search.startPeriod ?? search.period ?? getCurrentPeriodInBrazil();
  return { startPeriod, endPeriod: addMonthsToPeriod(startPeriod, defaultCommitmentMonths - 1) };
}

function capitalize(label: string) {
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function formatCommitmentPeriod(period: string) {
  return capitalize(
    formatDateInBrazil(periodToSafeInstant(period), { month: "long", year: "numeric" }),
  );
}

export function formatCommitmentChartPeriod(period: string) {
  return capitalize(
    formatDateInBrazil(periodToSafeInstant(period), { month: "short", year: "numeric" })
      .replaceAll(".", "")
      .replace(" de ", " "),
  );
}

export function formatCommitmentPercentage(value: number | null) {
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

const statusLabels: Record<CommitmentStatus, string> = {
  healthy: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
};

export function commitmentStatusLabel(status: CommitmentStatus) {
  return statusLabels[status];
}

export function commitmentStatusClassName(status: CommitmentStatus) {
  if (status === "healthy") return "bg-success/15 text-success";
  if (status === "attention") return "bg-warning/15 text-warning";
  return undefined;
}

export function commitmentStatusVariant(status: CommitmentStatus) {
  return status === "critical" ? ("destructive" as const) : ("secondary" as const);
}
