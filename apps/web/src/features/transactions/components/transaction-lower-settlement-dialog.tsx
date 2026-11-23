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
import { getLowerSettlementConfirmation } from "../transactions.presentation";

export function TransactionLowerSettlementDialog({
  amount,
  onConfirm,
  onOpenChange,
  onPartial,
  open,
  plannedAmount,
  type,
}: {
  amount: number;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  onPartial: () => void;
  open: boolean;
  plannedAmount: number;
  type: "income" | "expense";
}) {
  const confirmation = getLowerSettlementConfirmation({ amount, plannedAmount, type });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              onPartial();
            }}
            variant="outline"
          >
            {confirmation.partial}
          </AlertDialogAction>
          <AlertDialogAction
            className="col-span-2"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmation.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
