import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { DueDateIndicator } from "@/features/due-date-rules/components/due-date-indicator";
import { formatCompactDate, isTransactionLocked } from "../transactions.presentation";

export function TransactionDueDate({ transaction }: { transaction: TransactionOutput }) {
  if (!transaction.dueDate) return null;
  // Its date comes from another transaction, so there is no rule to make an exception to.
  if (isTransactionLocked(transaction))
    return (
      <span>
        {transaction.origin === "reimbursement" ? "Previsto" : "Venc."}{" "}
        {formatCompactDate(transaction.dueDate)}
      </span>
    );
  return (
    <DueDateIndicator
      dueDate={transaction.dueDate}
      originalDueDate={transaction.originalDueDate}
      adjustment={transaction.dueDateAdjustment}
      excluded={transaction.dueDateRuleExcluded}
      editable={transaction.dueDateExceptionEditable}
      target={
        transaction.recordId
          ? { target: "transaction", transactionId: transaction.recordId }
          : transaction.recurringRuleId
            ? {
                target: "recurring",
                recurringRuleId: transaction.recurringRuleId,
                occurrenceDate: transaction.purchaseDate,
              }
            : undefined
      }
    >
      Venc. {formatCompactDate(transaction.dueDate)}
    </DueDateIndicator>
  );
}
