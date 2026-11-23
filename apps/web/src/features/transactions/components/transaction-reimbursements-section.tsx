import type {
  LinkedReimbursementOutput,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, ReceiptText } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUpdateReimbursementMutation } from "../transactions.mutations";
import {
  formatDate,
  formatPeriod,
  getLinkedReimbursementStatus,
  getTransactionMutationErrorMessage,
} from "../transactions.presentation";
import { linkedReimbursementsQueryOptions } from "../transactions.queries";
import { DetailRow, DetailsSection, SectionTitle } from "./transaction-details-section";

const statusClassNames = {
  danger: "text-destructive",
  muted: "text-muted-foreground",
  success: "text-success",
  warning: "text-foreground",
} as const;

/** Reimbursements of an expense, one per person and, in a purchase in installments, per month. */
export function ExpenseReimbursementsSection({
  onOpen,
  transaction,
}: {
  onOpen: (id: string) => void;
  transaction: TransactionOutput;
}) {
  const query = useQuery(linkedReimbursementsQueryOptions(transaction));
  const items = query.data?.items.filter((item) => item.isCurrent) ?? [];
  if (!items.length) return null;

  return (
    <section aria-labelledby="transaction-details-reimbursements" className="grid gap-2">
      <SectionTitle icon={<HandCoins />} id="transaction-details-reimbursements">
        Reembolsos
      </SectionTitle>
      <ul className="grid gap-1 rounded-xl border p-2">
        {items.map((item) => (
          <li key={item.id}>
            <ReimbursementLink item={item} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReimbursementLink({
  item,
  onOpen,
}: {
  item: LinkedReimbursementOutput;
  onOpen: (id: string) => void;
}) {
  const status = getLinkedReimbursementStatus(item);
  return (
    <button
      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(item.id)}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          <AvatarImage alt="" src={item.personAvatarUrl ?? undefined} />
          <AvatarFallback>{item.personName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm">{item.personName}</span>
          <span className={cn("block text-xs", statusClassNames[status.tone])}>{status.label}</span>
        </span>
      </span>
      <MoneyValue amount={item.totalAmount} className="shrink-0 font-medium" />
    </button>
  );
}

/** The expense a reimbursement pays back, and the two things that can be changed on it. */
export function ReimbursementSourceSection({
  onOpen,
  transaction,
}: {
  onOpen: (id: string) => void;
  transaction: TransactionOutput;
}) {
  const id = useId();
  const update = useUpdateReimbursementMutation();
  const source = transaction.reimbursementSource;
  if (!source) return null;
  const sourceId = source.transactionId;
  const editable = !transaction.parentTransactionId && transaction.isSettled === false;

  async function change(data: { isGuaranteed?: boolean; dueDate?: string }) {
    try {
      await update.mutateAsync({ id: transaction.recordId as string, data });
      toast.success("Reembolso atualizado");
    } catch (error) {
      toast.error("Não foi possível atualizar o reembolso", {
        description: getTransactionMutationErrorMessage(error),
      });
    }
  }

  return (
    <>
      <DetailsSection icon={<ReceiptText />} title="Despesa vinculada">
        <DetailRow
          label="Despesa"
          value={
            sourceId ? (
              <button
                className="truncate font-medium text-brand-strong hover:underline"
                onClick={() => onOpen(sourceId)}
                type="button"
              >
                {source.name}
              </button>
            ) : (
              source.name
            )
          }
        />
        {source.currentInstallment && source.installmentCount ? (
          <DetailRow
            label="Parcela"
            value={`${source.currentInstallment} de ${source.installmentCount}`}
          />
        ) : null}
        <DetailRow label="Mês da despesa" value={formatPeriod(source.period)} />
        {source.dueDate ? (
          <DetailRow label="Vencimento da despesa" value={formatDate(source.dueDate)} />
        ) : null}
      </DetailsSection>
      {editable ? (
        <div className="grid gap-3 rounded-xl border p-3">
          <div className="grid gap-1">
            <Label className="text-sm" htmlFor={`${id}-guaranteed`}>
              <Checkbox
                checked={transaction.isGuaranteed === true}
                disabled={update.isPending}
                id={`${id}-guaranteed`}
                onCheckedChange={(value) => void change({ isGuaranteed: value === true })}
              />
              Reembolso garantido
            </Label>
            <p className="text-muted-foreground text-xs">
              Garantido, já conta nas previsões, nos orçamentos e na categoria da despesa.
            </p>
          </div>
          {source.dueDateEditable ? (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-date`}>Previsão do reembolso</Label>
              <DatePicker
                disabled={update.isPending}
                id={`${id}-date`}
                onChange={(dueDate) => {
                  if (dueDate && dueDate !== transaction.dueDate) void change({ dueDate });
                }}
                value={transaction.dueDate ?? ""}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              A previsão acompanha o vencimento da despesa. Se atrasar, você poderá informar uma
              nova data.
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
