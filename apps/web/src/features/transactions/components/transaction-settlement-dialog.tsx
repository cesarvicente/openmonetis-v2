import type { ReimbursementSurplusDestination } from "@openmonetis/domain/reimbursements";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import { SettleTransactionsInputSchema } from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileDatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/money-presentation";
import { getTransactionMutationErrorMessage } from "../transactions.presentation";
import { linkedReimbursementsQueryOptions } from "../transactions.queries";
import { TransactionLowerSettlementDialog } from "./transaction-lower-settlement-dialog";
import { TransactionSurplusDialog } from "./transaction-surplus-dialog";

export type SettlementTarget = {
  ids?: string[];
  recurringRuleId?: string;
  purchaseDate?: string;
  type: "income" | "expense";
  name: string;
  plannedAmount: number;
  accountId: string | null;
  divided: boolean;
  /** A reimbursement asks where to place what was received above it. */
  reimbursementId?: string;
  partiallyPaid?: boolean;
};
export type SettlementValues = {
  settledDate: string;
  settledAmount?: number;
  accountId: string;
  surplusDestination?: ReimbursementSurplusDestination;
};
export type PartialSettlementValues = { amount: number; date: string; accountId: string };

export function TransactionSettlementDialog({
  target,
  accounts,
  onClose,
  onConfirm,
  onPartial,
}: {
  target: SettlementTarget;
  accounts: AccountOutput[];
  onClose: () => void;
  onConfirm: (values: SettlementValues) => Promise<void>;
  onPartial: (values: PartialSettlementValues) => Promise<void>;
}) {
  const id = useId();
  const income = target.type === "income";
  const multiple = (target.ids?.length ?? 0) > 1;
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const [lowerOpen, setLowerOpen] = useState(false);
  const [surplusOpen, setSurplusOpen] = useState(false);
  const linkedQuery = useQuery({
    ...linkedReimbursementsQueryOptions({
      recordId: target.reimbursementId ?? null,
      recurringRuleId: null,
      purchaseDate: "",
    }),
    enabled: Boolean(target.reimbursementId),
  });
  const linked = linkedQuery.data?.items ?? [];
  const nextReimbursement = linked.find((item) => item.isNext);

  async function run(operation: () => Promise<void>) {
    try {
      await operation();
      onClose();
    } catch (error) {
      toast.error("Não foi possível registrar a baixa", {
        description: getTransactionMutationErrorMessage(error),
      });
    }
  }
  const form = useForm({
    defaultValues: {
      settledDate: getCurrentDateInBrazil(),
      amount: String(target.plannedAmount),
      partial: false,
      accountId:
        accounts.find((account) => account.id === target.accountId && !account.isArchived)?.id ??
        accounts.find((account) => !account.isArchived)?.id ??
        "",
    },
    onSubmit: async ({ value }) => {
      const amount = Number(value.amount);
      const parsed = SettleTransactionsInputSchema.safeParse({
        ids: target.ids ?? [target.recurringRuleId],
        isSettled: true,
        settledDate: value.settledDate,
        settledAmount: multiple ? undefined : amount,
        accountId: value.accountId,
      });
      if (!parsed.success || value.settledDate > getCurrentDateInBrazil()) {
        toast.error("Confira o valor, a conta e a data da baixa.");
        return;
      }
      if (!multiple && value.partial) {
        if (amount >= target.plannedAmount) {
          toast.error("O valor parcial deve ser menor que o previsto.");
          return;
        }
        await run(() => onPartial({ amount, date: value.settledDate, accountId: value.accountId }));
        return;
      }
      if (!multiple && amount < target.plannedAmount) {
        setLowerOpen(true);
        return;
      }
      if (target.reimbursementId && amount > target.plannedAmount && nextReimbursement) {
        setSurplusOpen(true);
        return;
      }
      await run(() => onConfirm(buildValues()));
    },
  });

  function buildValues(surplusDestination?: ReimbursementSurplusDestination): SettlementValues {
    const { accountId, amount, settledDate } = form.state.values;
    return {
      settledDate,
      settledAmount: multiple ? undefined : Number(amount),
      accountId,
      ...(surplusDestination ? { surplusDestination } : {}),
    };
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.state.isSubmitting) onClose();
      }}
    >
      <DialogContent guarded mobileLayout="sheet" className="gap-4">
        <DialogHeader>
          <DialogTitle>{income ? "Registrar recebimento" : "Registrar pagamento"}</DialogTitle>
          <DialogDescription>
            {target.name}. Informe os dados da baixa já realizada.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">
          {multiple
            ? `${target.ids?.length} lançamentos serão confirmados pelos respectivos valores previstos.`
            : `${target.partiallyPaid ? "Restante" : "Valor previsto"}: ${formatCurrency(target.plannedAmount)}`}
        </p>
        <form
          className="grid gap-4"
          data-mobile-page-form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => <MobileFormState {...state} />}
          </form.Subscribe>
          {!multiple ? (
            <>
              <form.Field name="amount">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-amount`}>
                      {income ? "Valor recebido" : "Valor pago"}
                    </Label>
                    <CurrencyInput
                      id={`${id}-amount`}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="partial">
                {(field) => (
                  <div className="grid gap-1">
                    <Label className="text-sm" htmlFor={`${id}-partial`}>
                      <Checkbox
                        checked={field.state.value}
                        id={`${id}-partial`}
                        onCheckedChange={(value) => field.handleChange(value === true)}
                      />
                      {income ? "Recebimento parcial" : "Pagamento parcial"}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      O restante continua em aberto neste lançamento.
                    </p>
                  </div>
                )}
              </form.Field>
            </>
          ) : null}
          <form.Field name="settledDate">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-date`}>
                  {income ? "Data do recebimento" : "Data do pagamento"}
                </Label>
                <MobileDatePicker
                  id={`${id}-date`}
                  max={getCurrentDateInBrazil()}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="accountId">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-account`}>
                  {multiple ? "Conta para todos os lançamentos" : "Conta da baixa"}
                </Label>
                <Select
                  items={activeAccounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                  }))}
                  value={field.state.value}
                  onValueChange={(value) => value && field.handleChange(value)}
                >
                  <SelectTrigger id={`${id}-account`} className="w-full">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          {target.divided ? (
            <p className="text-muted-foreground text-xs">
              O valor efetivo será dividido proporcionalmente entre as pessoas. Confira o valor
              antes de confirmar.
            </p>
          ) : null}
          <form.Subscribe selector={(state) => [state.isSubmitting, state.values.amount] as const}>
            {([pending, amount]) => (
              <>
                <TransactionLowerSettlementDialog
                  amount={Number(amount)}
                  onConfirm={() => run(() => onConfirm(buildValues()))}
                  onOpenChange={setLowerOpen}
                  onPartial={() =>
                    run(() =>
                      onPartial({
                        amount: Number(amount),
                        date: form.state.values.settledDate,
                        accountId: form.state.values.accountId,
                      }),
                    )
                  }
                  open={lowerOpen}
                  plannedAmount={target.plannedAmount}
                  type={target.type}
                />
                {nextReimbursement ? (
                  <TransactionSurplusDialog
                    next={nextReimbursement}
                    onChoose={(destination) => run(() => onConfirm(buildValues(destination)))}
                    onOpenChange={setSurplusOpen}
                    open={surplusOpen}
                    surplus={Number(amount) - target.plannedAmount}
                  />
                ) : null}
                <DialogFooter>
                  <Button
                    data-mobile-cancel
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending || (Boolean(target.reimbursementId) && linkedQuery.isLoading)}
                  >
                    {pending ? "Registrando…" : "Confirmar baixa"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
