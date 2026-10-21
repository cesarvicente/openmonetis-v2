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
export function getOccurrenceAmount(
  rule: SettlementAwareRule,
  date: string,
  expected: string | number,
  personId = rule.allocationPersonId,
) {
  const state = rule.occurrenceOverrides?.[date];
  if (!state?.isSettled || state.amount == null) return Number(expected);
  if (personId) {
    const allocation = state.allocations?.find((share) =>
      personId === "admin" ? share.role === "admin" : share.personId === personId,
    );
    return allocation ? Number(allocation.amount) : 0;
  }
  return Number(state.amount);
}
