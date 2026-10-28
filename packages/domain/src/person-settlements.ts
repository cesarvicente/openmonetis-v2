import { resolveCardClosingRule } from "./cards";
import { fromCents, toCents } from "./money";
import {
  getRecurringDueDate,
  projectRecurringMonthAllocations,
  type RecurringAllocationRule,
} from "./recurring-expenses";
import { addMonthsToPeriod, deriveTransactionPeriod, type PaymentMethod } from "./transactions";

export type PersonRecurringBalanceRule = RecurringAllocationRule & {
  paymentMethod: PaymentMethod;
  card: (Parameters<typeof resolveCardClosingRule>[0] & { dueDay: number }) | null;
};

export function getPersonRecurringBalanceOccurrencePeriods(period: string) {
  // Inverse of deriveTransactionPeriod's invoice offsets (-1 through +2).
  return [-2, -1, 0, 1].map((offset) => addMonthsToPeriod(period, offset));
}

export function projectPersonRecurringBalanceAllocations(input: {
  period: string;
  rules: PersonRecurringBalanceRule[];
}) {
  return input.rules.flatMap((rule) => {
    const periods =
      rule.paymentMethod === "credit_card" && rule.card
        ? getPersonRecurringBalanceOccurrencePeriods(input.period)
        : [input.period];

    return periods.flatMap((period) =>
      projectRecurringMonthAllocations({ period, rules: [rule] }).flatMap((allocation) => {
        const balancePeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate: allocation.occurrenceDate,
          dueDate: getRecurringDueDate(rule.dueDate ?? null, allocation.occurrenceDate),
          card: rule.card
            ? {
                closingDay: rule.card.closingDay,
                closingRule: resolveCardClosingRule(rule.card),
                dueDay: rule.card.dueDay,
              }
            : null,
        });

        return balancePeriod === input.period ? [{ ...allocation, period: balancePeriod }] : [];
      }),
    );
  });
}

export const personSettlementStatuses = ["receivable", "settled", "credit"] as const;

export type PersonSettlementStatus = (typeof personSettlementStatuses)[number];

export type PersonBalanceEntry = {
  amount: number;
  kind: "expense" | "refund" | "settlement";
};

export type PersonBalance = {
  assignedAmount: number;
  refundedAmount: number;
  settledAmount: number;
  /** Assigned minus refunded: what the person owes for the period before settlements. */
  dueAmount: number;
  /** Portion of `dueAmount` already covered by settlements; excess becomes credit. */
  coveredAmount: number;
  balanceAmount: number;
  receivableAmount: number;
  creditAmount: number;
  status: PersonSettlementStatus;
};

export function calculatePersonBalance(entries: PersonBalanceEntry[]): PersonBalance {
  let assignedCents = 0;
  let refundedCents = 0;
  let settledCents = 0;

  for (const entry of entries) {
    const amountCents = Math.abs(toCents(entry.amount));
    if (entry.kind === "expense") assignedCents += amountCents;
    if (entry.kind === "refund") refundedCents += amountCents;
    if (entry.kind === "settlement") settledCents += amountCents;
  }

  const balanceCents = assignedCents - refundedCents - settledCents;
  const receivableCents = Math.max(0, balanceCents);
  const creditCents = Math.max(0, -balanceCents);
  const dueCents = Math.max(0, assignedCents - refundedCents);
  const coveredCents = Math.min(settledCents, dueCents);

  return {
    assignedAmount: fromCents(assignedCents),
    refundedAmount: fromCents(refundedCents),
    settledAmount: fromCents(settledCents),
    dueAmount: fromCents(dueCents),
    coveredAmount: fromCents(coveredCents),
    balanceAmount: fromCents(balanceCents),
    receivableAmount: fromCents(receivableCents),
    creditAmount: fromCents(creditCents),
    status: balanceCents > 0 ? "receivable" : balanceCents < 0 ? "credit" : "settled",
  };
}

/** A person without assignments, refunds or settlements in the period has nothing to settle. */
export function hasPersonBalanceActivity(balance: PersonBalance) {
  return balance.assignedAmount > 0 || balance.refundedAmount > 0 || balance.settledAmount > 0;
}

const personSettlementStatusPriority: Record<PersonSettlementStatus, number> = {
  receivable: 0,
  credit: 1,
  settled: 2,
};

/** Orders pending receivables first, then credits, then fully settled balances. */
export function comparePersonBalancePriority(left: PersonBalance, right: PersonBalance) {
  return (
    personSettlementStatusPriority[left.status] - personSettlementStatusPriority[right.status] ||
    Math.abs(right.balanceAmount) - Math.abs(left.balanceAmount)
  );
}

export type PersonBalancesSummary = {
  totalReceivableAmount: number;
  totalCreditAmount: number;
  pendingCount: number;
};

export function summarizePersonBalances(balances: PersonBalance[]): PersonBalancesSummary {
  const sum = (pick: (balance: PersonBalance) => number) =>
    fromCents(balances.reduce((total, balance) => total + toCents(pick(balance)), 0));

  return {
    totalReceivableAmount: sum((balance) => balance.receivableAmount),
    totalCreditAmount: sum((balance) => balance.creditAmount),
    pendingCount: balances.filter((balance) => balance.status === "receivable").length,
  };
}
