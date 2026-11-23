import type { PersonReceivableOutput } from "@openmonetis/validators/reimbursements";
import { MoneyValue } from "@/components/money-value";
import { cn } from "@/lib/utils";
import { getReceivableRows } from "../reimbursements.presentation";

const toneClassNames = {
  danger: "text-destructive",
  muted: "text-foreground",
  success: "text-success",
  warning: "text-foreground",
} as const;

export function PersonReceivableRows({
  periodLabel,
  receivable,
}: {
  periodLabel: string;
  receivable: PersonReceivableOutput;
}) {
  return (
    <dl className="grid gap-1.5 text-sm">
      {getReceivableRows(receivable, periodLabel).map((row) => (
        <div className="flex items-center justify-between gap-3" key={row.key}>
          <dt className="min-w-0 truncate text-muted-foreground text-xs">{row.label}</dt>
          <dd className={cn("shrink-0 font-medium", toneClassNames[row.tone])}>
            <MoneyValue amount={row.amount} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
