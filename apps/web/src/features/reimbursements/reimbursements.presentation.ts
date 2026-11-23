import type { PersonReceivableOutput } from "@openmonetis/validators/reimbursements";

type ReceivableRow = {
  key: "overdue" | "due" | "upcoming" | "partial" | "received";
  label: string;
  amount: number;
  tone: "danger" | "muted" | "success" | "warning";
};

/** Only what exists is shown, most urgent first. */
export function getReceivableRows(
  receivable: PersonReceivableOutput,
  periodLabel: string,
): ReceivableRow[] {
  const rows: ReceivableRow[] = [
    {
      key: "overdue",
      label:
        receivable.overdueCount === 1
          ? "Atrasado (1 lançamento)"
          : `Atrasado (${receivable.overdueCount} lançamentos)`,
      amount: receivable.overdueAmount,
      tone: "danger",
    },
    { key: "due", label: "A vencer no mês", amount: receivable.dueAmount, tone: "warning" },
    { key: "upcoming", label: "Próximos meses", amount: receivable.upcomingAmount, tone: "muted" },
    {
      key: "partial",
      label: "Já pago do que está em aberto",
      amount: receivable.partialAmount,
      tone: "success",
    },
    {
      key: "received",
      label: `Recebido em ${periodLabel}`,
      amount: receivable.receivedAmount,
      tone: "success",
    },
  ];
  return rows.filter((row) => row.amount > 0);
}

/** Floors the ratio so it never shows 100% while any amount is still pending. */
export function getReceivedPercentage(received: number, pending: number) {
  const total = Math.round((received + pending) * 100);
  if (total <= 0) return 100;
  return Math.floor((Math.round(received * 100) * 100) / total);
}
