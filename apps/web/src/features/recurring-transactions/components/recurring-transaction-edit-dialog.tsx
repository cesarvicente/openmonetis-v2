import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { MobileFormContent } from "@/components/forms/mobile-form-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { recurringTransactionOccurrenceQueryOptions } from "../recurring-transactions.queries";
import type { ReportItem } from "./recurring-transactions-report-page.types";

export function RecurringTransactionEditDialog({
  item,
  onOpenChange,
  ...props
}: Pick<
  ComponentProps<typeof TransactionDialog>,
  "accounts" | "cards" | "categories" | "people" | "onOpenChange"
> & { item: ReportItem }) {
  const query = useQuery(
    recurringTransactionOccurrenceQueryOptions(item.id, item.actionDate as string),
  );
  if (query.data)
    return (
      <TransactionDialog
        {...props}
        open
        onOpenChange={onOpenChange}
        transaction={query.data}
        lockType
        allowedConditions={["recurring"]}
      />
    );
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <MobileFormContent>
        <DialogHeader>
          <DialogTitle>Editar recorrência</DialogTitle>
          <DialogDescription>
            {query.isError
              ? "Não foi possível carregar os dados da recorrência."
              : "Carregando os dados da recorrência…"}
          </DialogDescription>
        </DialogHeader>
        {query.isError ? (
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            Aguarde…
          </p>
        )}
      </MobileFormContent>
    </Dialog>
  );
}
