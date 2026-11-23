import type { PersonOutput } from "@openmonetis/validators/people";
import { useId } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDate } from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import type { TransactionFormProps } from "./transaction-form.types";
import {
  getReimbursementFormState,
  getTransactionFormErrorMessage,
  type TransactionFormValues,
} from "./transaction-form.validation";

export function TransactionReimbursementFields({
  form,
  isSubmitting,
  people,
  transaction,
  values,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
  people: PersonOutput[];
  transaction: TransactionFormProps["transaction"];
  values: TransactionFormValues;
}) {
  const id = useId();
  const state = getReimbursementFormState(values, people, transaction);
  if (!state) return null;

  return (
    <section className="grid gap-3 rounded-lg border border-input bg-popover px-3 py-2.5">
      <form.Field name="isGuaranteed">
        {(field) => (
          <div className="grid gap-1">
            <Label className="text-sm" htmlFor={`${id}-guaranteed`}>
              <Checkbox
                checked={field.state.value}
                disabled={isSubmitting}
                id={`${id}-guaranteed`}
                onCheckedChange={(value) => field.handleChange(value === true)}
              />
              {state.kind === "expense" ? "Reembolso garantido" : "Recebimento garantido"}
            </Label>
            <p className="text-muted-foreground text-xs">
              {state.kind === "expense"
                ? "Será criado um reembolso vinculado a esta despesa. Garantido, ele já conta nas previsões, nos orçamentos e na categoria; sem marcar, só conta depois de recebido."
                : "Garantido, já conta nas previsões; sem marcar, só conta depois de recebido."}
            </p>
          </div>
        )}
      </form.Field>
      {state.kind === "expense" && state.dateEditable ? (
        <form.Field name="reimbursementDueDate">
          {(field) => (
            <FieldShell
              error={getTransactionFormErrorMessage(
                "reimbursementDueDate",
                field.state.meta.errors,
              )}
              label="Previsão do reembolso"
            >
              <DatePicker
                aria-invalid={field.state.meta.errors.length > 0}
                disabled={isSubmitting}
                id={`${id}-date`}
                onChange={field.handleChange}
                placeholder={state.currentDate ? formatDate(state.currentDate) : "Data combinada"}
                value={field.state.value}
              />
              <p className="text-muted-foreground text-xs">
                {state.overdue
                  ? "Está atrasado: informe a nova data combinada."
                  : "Quando a pessoa deve devolver o valor."}
              </p>
            </FieldShell>
          )}
        </form.Field>
      ) : state.kind === "expense" ? (
        <p className="text-muted-foreground text-xs">
          Previsão do reembolso:{" "}
          {values.paymentMethod === "credit_card"
            ? "vencimento da fatura"
            : values.dueDate
              ? `vencimento em ${formatDate(values.dueDate)}`
              : "data de cada ocorrência"}
          .
        </p>
      ) : null}
    </section>
  );
}
