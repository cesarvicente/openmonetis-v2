import { toCents } from "./money";
import { allocateAmountProportionally } from "./transactions";

export type SettlementAllocation = {
  personId: string;
  amount: string;
  role?: "admin" | "external";
};
export type OccurrenceOverride = {
  frozenDueDate?: string | null;
  dueDateRuleExcluded?: boolean | null;
  dueDateAdjustment?: import("./due-date-rules").DueDateAdjustmentDetails | null;
  isSettled: boolean;
  amount?: string | null;
  settledDate?: string | null;
  accountId?: string | null;
  allocations?: SettlementAllocation[] | null;
};
export type SettlementAwareRule = import("./recurring-expenses").DatedRecurringRule & {
  occurrenceOverrides?: Record<string, OccurrenceOverride>;
  allocationPersonId?: string;
  /** Expected from someone else without guarantee: only counts once received. */
  requiresSettlement?: boolean;
};
export class SettlementError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function planSettlement(input: {
  expectedAmount: string | number;
  amount?: number;
  date: string;
  today: string;
  allocations: Array<{ personId: string; amount: string | number; role?: "admin" | "external" }>;
}) {
  if (input.date > input.today) throw new SettlementError("SETTLEMENT_DATE_FUTURE");
  const absolute = input.amount ?? Math.abs(Number(input.expectedAmount));
  if (
    !Number.isFinite(absolute) ||
    absolute < 0.01 ||
    Math.abs(absolute * 100 - Math.round(absolute * 100)) > 0.00001 ||
    absolute > 999_999_999.99
  )
    throw new SettlementError("INVALID_SETTLEMENT_AMOUNT");
  const sign = Number(input.expectedAmount) < 0 ? -1 : 1;
  if (!input.allocations.length) throw new SettlementError("INVALID_SETTLEMENT_ALLOCATION");
  let amounts: number[];
  try {
    amounts =
      input.allocations.length === 1
        ? [absolute]
        : allocateAmountProportionally(
            absolute,
            input.allocations.map((share) => Math.abs(Number(share.amount))),
          );
  } catch (error) {
    if (error instanceof RangeError) throw new SettlementError("INVALID_SETTLEMENT_ALLOCATION");
    throw error;
  }
  return {
    amount: ((sign * Math.round(absolute * 100)) / 100).toFixed(2),
    settledDate: input.date,
    allocations: input.allocations.map((share, index) => ({
      personId: share.personId,
      role: share.role,
      amount: (sign * amounts[index]).toFixed(2),
    })),
  };
}
/** Takes a payment out of what is left, keeping the share of each person in both parts. */
export function planPartialPayment(input: {
  remainingAmount: string | number;
  amount: number;
  date: string;
  today: string;
  splits: Array<{ personId: string; amount: string | number }>;
}) {
  if (input.date > input.today) throw new SettlementError("SETTLEMENT_DATE_FUTURE");
  const sign = Number(input.remainingAmount) < 0 ? -1 : 1;
  const remainingCents = Math.abs(toCents(Number(input.remainingAmount)));
  const paidCents = toCents(input.amount);
  if (!Number.isFinite(input.amount) || paidCents <= 0)
    throw new SettlementError("INVALID_SETTLEMENT_AMOUNT");
  if (paidCents >= remainingCents) throw new SettlementError("PARTIAL_PAYMENT_NOT_PARTIAL");
  const signed = (cents: number) => ((sign * cents) / 100).toFixed(2);
  let paidShares: number[];
  try {
    paidShares = input.splits.length
      ? allocateAmountProportionally(
          input.amount,
          input.splits.map((split) => Math.abs(Number(split.amount))),
        )
      : [];
  } catch (error) {
    if (error instanceof RangeError) throw new SettlementError("INVALID_SETTLEMENT_ALLOCATION");
    throw error;
  }
  const splits = input.splits.map((split, index) => {
    const paid = toCents(paidShares[index] as number);
    const remaining = Math.abs(toCents(Number(split.amount))) - paid;
    if (remaining <= 0) throw new SettlementError("INVALID_SETTLEMENT_ALLOCATION");
    return {
      personId: split.personId,
      paidAmount: signed(paid),
      remainingAmount: signed(remaining),
    };
  });
  return {
    paidAmount: signed(paidCents),
    remainingAmount: signed(remainingCents - paidCents),
    splits,
  };
}
export function getOccurrenceAmount(
  rule: SettlementAwareRule,
  date: string,
  expected: string | number,
  personId = rule.allocationPersonId,
) {
  const state = rule.occurrenceOverrides?.[date];
  if (rule.requiresSettlement && !state?.isSettled) return 0;
  if (!state?.isSettled || state.amount == null) return Number(expected);
  if (personId) {
    const allocation = state.allocations?.find((share) =>
      personId === "admin" ? share.role === "admin" : share.personId === personId,
    );
    return allocation ? Number(allocation.amount) : 0;
  }
  return Number(state.amount);
}
