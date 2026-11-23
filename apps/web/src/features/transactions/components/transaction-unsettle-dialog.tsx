import type { TransactionOutput } from "@openmonetis/validators/transactions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTransactionUnsettleConfirmation } from "../transactions.presentation";

export type UnsettleTarget = {
  name: string;
  type: TransactionOutput["type"];
  onConfirm: () => Promise<void>;
};

export function TransactionUnsettleDialog({
  onClose,
  target,
}: {
  onClose: () => void;
  target: UnsettleTarget | null;
}) {
  if (!target) return null;
  const confirmation = getTransactionUnsettleConfirmation(target.type, target.name);

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onClose();
              void target.onConfirm();
            }}
            variant="destructive"
          >
            {confirmation.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
