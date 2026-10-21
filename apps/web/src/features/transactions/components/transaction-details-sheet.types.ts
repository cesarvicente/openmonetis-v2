import type {
  RecurringOccurrenceActionInput,
  TransactionActionScope,
  TransactionOutput,
} from "@openmonetis/validators/transactions";

export type TransactionDetailsSheetProps = {
  onEdit: (transaction: TransactionOutput) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  transaction: TransactionOutput | null;
  mobileActions?: {
    onAnticipate: (transaction: TransactionOutput) => void;
    onCopy: (transaction: TransactionOutput) => void;
    onDelete: (transaction: TransactionOutput, scope?: TransactionActionScope) => void;
    onRecurringAction: (
      id: string,
      action: RecurringOccurrenceActionInput["action"],
      occurrenceDate: string,
    ) => Promise<void> | void;
    onRefund: (transaction: TransactionOutput) => void;
    onSettle: (ids: string[], isSettled: boolean) => void;
    onSettleRecurringOccurrence: (id: string, date: string, isSettled: boolean) => void;
    onUndoAnticipation: (transaction: TransactionOutput) => void;
    pendingSettlementKey: string | null;
    pendingTransactionId: string | null;
  };
};
