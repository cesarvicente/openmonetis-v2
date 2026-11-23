import type { ReimbursementSurplusDestination } from "@openmonetis/domain/reimbursements";
import type { LinkedReimbursementOutput } from "@openmonetis/validators/transactions";
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
import { getReimbursementSurplusQuestion } from "../transactions.presentation";

export function TransactionSurplusDialog({
  next,
  onChoose,
  onOpenChange,
  open,
  surplus,
}: {
  next: LinkedReimbursementOutput;
  onChoose: (destination: ReimbursementSurplusDestination) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  surplus: number;
}) {
  const question = getReimbursementSurplusQuestion({ next, surplus });

  function choose(destination: ReimbursementSurplusDestination) {
    onOpenChange(false);
    onChoose(destination);
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{question.title}</AlertDialogTitle>
          <AlertDialogDescription>{question.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={() => choose("income")} variant="outline">
            Registrar como receita
          </AlertDialogAction>
          <AlertDialogAction className="col-span-2" onClick={() => choose("next")}>
            Descontar do próximo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
