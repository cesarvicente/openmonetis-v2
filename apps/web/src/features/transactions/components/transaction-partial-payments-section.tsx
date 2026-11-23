import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/money-presentation";
import { useRemovePartialPaymentMutation } from "../transactions.mutations";
import { formatDate, getTransactionMutationErrorMessage } from "../transactions.presentation";
import { partialPaymentsQueryOptions } from "../transactions.queries";
import { SectionTitle } from "./transaction-details-section";

export function TransactionPartialPaymentsSection({
  transaction,
}: {
  transaction: TransactionOutput;
}) {
  const recordId = transaction.recordId as string;
  const query = useQuery(partialPaymentsQueryOptions(recordId));
  const remove = useRemovePartialPaymentMutation();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const income = transaction.type === "income";
  const data = query.data;
  if (!data) return null;
  const removing = data.payments.find((payment) => payment.id === removingId);

  async function undo(paymentId: string) {
    try {
      await remove.mutateAsync({ id: recordId, paymentId });
      toast.success(income ? "Recebimento parcial desfeito" : "Pagamento parcial desfeito");
    } catch (error) {
      toast.error("Não foi possível desfazer", {
        description: getTransactionMutationErrorMessage(error),
      });
    }
  }

  return (
    <section aria-labelledby="transaction-details-partial" className="grid gap-2">
      <SectionTitle
        icon={<span className="font-semibold">~</span>}
        id="transaction-details-partial"
      >
        {income ? "Recebimentos parciais" : "Pagamentos parciais"}
      </SectionTitle>
      <div className="grid gap-3 rounded-xl border p-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Amount amount={data.totalAmount} label="Total" />
          <Amount amount={data.paidAmount} label={income ? "Recebido" : "Pago"} />
          <Amount amount={data.remainingAmount} label="Restante" />
        </div>
        <Progress
          aria-label={income ? "Parte recebida" : "Parte paga"}
          value={data.totalAmount > 0 ? Math.floor((data.paidAmount / data.totalAmount) * 100) : 0}
        />
        <ul className="grid divide-y">
          {data.payments.map((payment) => (
            <li className="flex items-center justify-between gap-3 py-2" key={payment.id}>
              <span className="min-w-0">
                <span className="block text-sm">
                  {payment.date ? formatDate(payment.date) : "Sem data"}
                </span>
                <span className="block truncate text-muted-foreground text-xs">
                  {payment.accountName ?? "Sem conta"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <MoneyValue amount={payment.amount} className="font-medium text-sm" />
                <Button
                  aria-label={`Desfazer ${formatCurrency(payment.amount)}`}
                  disabled={data.isSettled || remove.isPending}
                  onClick={() => setRemovingId(payment.id)}
                  size="icon-sm"
                  title={
                    data.isSettled
                      ? "Desfaça primeiro a quitação do lançamento"
                      : "Desfazer este pagamento parcial"
                  }
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <AlertDialog onOpenChange={(open) => !open && setRemovingId(null)} open={Boolean(removing)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {income ? "Desfazer recebimento parcial?" : "Desfazer pagamento parcial?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing
                ? `${formatCurrency(removing.amount)} voltam a ficar em aberto e o saldo da conta é recalculado.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) void undo(removing.id);
                setRemovingId(null);
              }}
              variant="destructive"
            >
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Amount({ amount, label }: { amount: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <MoneyValue amount={amount} className="font-medium" />
    </div>
  );
}
