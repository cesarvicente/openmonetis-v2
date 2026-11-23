import type { TransactionOutput } from "@openmonetis/validators/transactions";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatPeriod, getTransactionStatusTags } from "../transactions.presentation";

const toneClassNames = {
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "border text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-foreground",
} as const;

/** Overdue, partial and reimbursement marks shown beside a transaction's name. */
export function TransactionStatusTags({ transaction }: { transaction: TransactionOutput }) {
  return getTransactionStatusTags(transaction).map((tag) => (
    <StatusTag
      className={toneClassNames[tag.tone]}
      key={tag.label}
      title={
        tag.kind === "overdue" && transaction.isCarriedOver
          ? `De ${formatPeriod(transaction.period)}, ainda em aberto`
          : undefined
      }
    >
      {tag.label}
    </StatusTag>
  ));
}

function StatusTag({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className: string;
  title?: string;
}) {
  return (
    <span
      className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-medium text-xs", className)}
      title={title}
    >
      {children}
    </span>
  );
}
