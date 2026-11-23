import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { getTransactionRemovalWarnings } from "../transactions.presentation";

export function TransactionRemovalWarnings({
  series = false,
  transaction,
}: {
  series?: boolean;
  transaction: TransactionOutput;
}) {
  const warnings = series
    ? transaction.reimbursementSummary
      ? [
          "Os reembolsos vinculados às parcelas removidas também serão removidos, inclusive os já recebidos, que saem do saldo da conta.",
        ]
      : []
    : getTransactionRemovalWarnings(transaction);
  if (!warnings.length) return null;

  return (
    <ul className="grid gap-1 rounded-lg border border-warning/30 bg-warning/10 p-3 text-left text-sm">
      {warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
  );
}
