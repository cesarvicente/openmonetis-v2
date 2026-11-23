import { fromCents, toCents } from "./money";
export type InvoicePersonMovement = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  amount: number;
};

export type InvoicePersonBalance = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  amount: number;
};

export type InvoiceAdjustmentDraft = {
  amount: string;
  type: "expense";
};

/** Whose purchases make up the invoice; the invoice itself is always paid as a whole. */
export function calculateInvoicePersonBalances(
  movements: InvoicePersonMovement[],
): InvoicePersonBalance[] {
  const people = new Map<string, InvoicePersonBalance>();
  for (const movement of movements) {
    const current = people.get(movement.personId) ?? { ...movement, amount: 0 };
    current.amount -= toCents(movement.amount);
    people.set(movement.personId, current);
  }
  return [...people.values()]
    .filter((person) => person.amount > 0)
    .map(({ personId, personName, personAvatarUrl, personRole, amount }) => ({
      personId,
      personName,
      personAvatarUrl,
      personRole,
      amount: fromCents(amount),
    }))
    .sort((a, b) => b.amount - a.amount || a.personName.localeCompare(b.personName));
}

export function calculateInvoiceTotals(
  movements: Array<{ amount: number }>,
  payments: Array<{ amount: number }>,
) {
  const amountCents = Math.max(
    0,
    -movements.reduce((sum, movement) => sum + toCents(movement.amount), 0),
  );
  const paidCents = Math.min(
    amountCents,
    payments.reduce((sum, payment) => sum + toCents(payment.amount), 0),
  );
  return {
    amount: fromCents(amountCents),
    paidAmount: fromCents(paidCents),
    remainingAmount: fromCents(amountCents - paidCents),
  };
}

export function isValidInvoicePaymentAmount(amount: number, remainingAmount: number) {
  const cents = toCents(amount);
  return cents > 0 && cents <= toCents(remainingAmount);
}

export function createInvoiceAdjustmentDraft(
  currentAmount: number,
  desiredAmount: number,
): InvoiceAdjustmentDraft | null {
  const adjustmentCents = toCents(desiredAmount) - toCents(currentAmount);
  if (adjustmentCents === 0) return null;

  return {
    amount: fromCents(-adjustmentCents).toFixed(2),
    type: "expense",
  };
}
