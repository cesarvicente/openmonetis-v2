import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  CreateInvoicePaymentInputSchema,
  type DashboardInvoice,
  type DashboardInvoicesOutput,
} from "@openmonetis/validators/invoices";
import { useForm } from "@tanstack/react-form";
import { Image } from "@unpic/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { PaymentSuccess } from "@/components/payment-success";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseCurrencyInput } from "@/features/accounts/accounts.presentation";
import { formatCurrency } from "@/lib/money-presentation";
import { usePayInvoiceMutation } from "../invoices.mutations";

type InvoiceAccount = DashboardInvoicesOutput["accounts"][number];

export function InvoicePaymentDialog({
  invoice,
  accounts,
  open,
  onOpenChange,
}: {
  invoice: DashboardInvoice | null;
  accounts: DashboardInvoicesOutput["accounts"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const mutation = usePayInvoiceMutation();
  const [paymentResult, setPaymentResult] = useState<{
    status: DashboardInvoice["status"];
  } | null>(null);
  const today = getCurrentDateInBrazil();
  const defaultAccountId =
    invoice && accounts.some((account) => account.id === invoice.accountId)
      ? invoice.accountId
      : (accounts[0]?.id ?? "");
  const form = useForm({
    defaultValues: {
      mode: "invoice" as "invoice" | "manual",
      accountId: defaultAccountId,
      amount: "",
      paidAt: today,
    },
    onSubmit: async ({ value }) => {
      if (!invoice) return;
      const parsed = CreateInvoicePaymentInputSchema.safeParse({
        accountId: value.accountId,
        paidAt: value.paidAt,
        amount:
          value.mode === "invoice" ? invoice.remainingAmount : parseCurrencyInput(value.amount),
      });
      if (!parsed.success) {
        toast.error("Revise os dados do pagamento", {
          description: "Informe uma conta e um valor válidos.",
        });
        return;
      }
      try {
        const result = await mutation.mutateAsync({
          cardId: invoice.cardId,
          period: invoice.period,
          input: parsed.data,
        });
        setPaymentResult({ status: result.status });
      } catch {
        toast.error("Não foi possível registrar o pagamento", {
          description: "Confira o valor e o saldo restante da fatura.",
        });
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (!next) setPaymentResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent guarded className="gap-4 overflow-x-hidden" key={invoice?.cardId}>
        {paymentResult ? (
          <PaymentSuccess
            celebrate={paymentResult.status === "paid"}
            description={
              paymentResult.status === "paid"
                ? "A fatura foi quitada e o pagamento já está no extrato."
                : "O pagamento está no extrato. A fatura continua com saldo em aberto."
            }
            onClose={() => {
              setPaymentResult(null);
              onOpenChange(false);
            }}
            title={paymentResult.status === "paid" ? "Fatura paga!" : "Pagamento registrado!"}
          />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {invoice?.logo ? (
                  <Image
                    alt=""
                    className="size-10 rounded-full object-contain"
                    height={40}
                    layout="fixed"
                    src={invoice.logo}
                    width={40}
                  />
                ) : null}
                <DialogTitle>Registrar pagamento da fatura</DialogTitle>
              </div>
              <DialogDescription>
                {invoice
                  ? `${invoice.cardName} · saldo de ${formatCurrency(invoice.remainingAmount)}`
                  : "Escolha como deseja pagar."}
              </DialogDescription>
            </DialogHeader>
            <form
              data-mobile-page-form
              className="grid w-full gap-4"
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
              <form.Field name="mode">
                {(field) => (
                  <Tabs
                    aria-label="Forma de pagamento da fatura"
                    className="min-w-0 gap-0"
                    onValueChange={(value) =>
                      value && field.handleChange(value as typeof field.state.value)
                    }
                    value={field.state.value}
                  >
                    <TabsList
                      className="min-h-11 min-w-0 items-stretch group-data-horizontal/tabs:h-auto"
                      variant="line"
                    >
                      <TabsTrigger
                        className="min-w-0 whitespace-normal px-1 py-2 text-center text-xs leading-tight group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-1 sm:px-3 sm:text-sm"
                        value="invoice"
                      >
                        Fatura inteira
                      </TabsTrigger>
                      <TabsTrigger
                        className="min-w-0 whitespace-normal px-1 py-2 text-center text-xs leading-tight group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-1 sm:px-3 sm:text-sm"
                        value="manual"
                      >
                        Valor parcial
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.mode}>
                {(mode) =>
                  mode === "manual" ? (
                    <form.Field name="amount">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={`${id}-amount`}>Valor</Label>
                          <CurrencyInput
                            id={`${id}-amount`}
                            onValueChange={field.handleChange}
                            placeholder="R$ 0,00"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  ) : null
                }
              </form.Subscribe>
              <form.Field name="accountId">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-account`}>Conta de pagamento</Label>
                    <Select
                      items={accounts.map((account) => ({
                        value: account.id,
                        label: <AccountOption account={account} />,
                      }))}
                      value={field.state.value}
                      onValueChange={(value) => value && field.handleChange(value)}
                    >
                      <SelectTrigger className="w-full" id={`${id}-account`}>
                        <SelectValue placeholder="Selecione uma conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <AccountOption account={account} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
              <form.Field name="paidAt">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`${id}-paid-at`}>Data do pagamento</Label>
                    <DatePicker
                      id={`${id}-paid-at`}
                      max={today}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  disabled={mutation.isPending}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <form.Subscribe selector={(state) => state.values.accountId}>
                  {(accountId) => (
                    <Button disabled={mutation.isPending || !invoice || !accountId} type="submit">
                      {mutation.isPending ? "Registrando…" : "Confirmar pagamento"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountOption({ account }: { account: InvoiceAccount }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {account.logo ? (
        <Image
          alt=""
          className="size-5 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={account.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-muted font-medium text-[9px]">
          {account.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
        </span>
      )}
      <span className="truncate">{account.name}</span>
    </span>
  );
}
