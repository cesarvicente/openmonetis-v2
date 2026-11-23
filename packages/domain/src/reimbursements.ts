import { fromCents, toCents } from "./money";
import { allocateRefundByResponsibility, type TransactionType } from "./transactions";

export const reimbursementNamePrefix = "Reembolso - ";
export const reimbursementSurplusNamePrefix = "Sobra - ";
export const reimbursementSurplusDestinations = ["income", "next"] as const;
export type ReimbursementSurplusDestination = (typeof reimbursementSurplusDestinations)[number];
/** How far ahead reimbursements of recurring expenses are created. */
export const reimbursementHorizonMonths = 12;

const maximumNameLength = 160;

export class ReimbursementError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ReimbursementError";
  }
}

export function createReimbursementName(expenseName: string) {
  return `${reimbursementNamePrefix}${expenseName}`.slice(0, maximumNameLength);
}

export function createReimbursementSurplusName(reimbursementName: string) {
  return `${reimbursementSurplusNamePrefix}${reimbursementName}`.slice(0, maximumNameLength);
}

type ReimbursablePerson = { personId: string; role: "admin" | "external" };

/**
 * What each other person owes for an expense: their share of it, less their part of store refunds.
 */
export function calculateReimbursementShares(input: {
  amount: number | string;
  owner: ReimbursablePerson;
  splits: Array<ReimbursablePerson & { amount: number | string }>;
  refundedAmount?: number | string;
}) {
  const shares = input.splits.length ? input.splits : [{ ...input.owner, amount: input.amount }];
  const refunded = Math.abs(Number(input.refundedAmount ?? 0));
  const refundByPerson = new Map(
    refunded > 0
      ? allocateRefundByResponsibility(refunded, input.owner.personId, shares).map((share) => [
          share.personId,
          toCents(share.amount),
        ])
      : [],
  );
  return shares.flatMap((share) => {
    if (share.role === "admin") return [];
    const cents =
      Math.abs(toCents(Number(share.amount))) - (refundByPerson.get(share.personId) ?? 0);
    return cents > 0 ? [{ personId: share.personId, amount: fromCents(cents) }] : [];
  });
}

/** The date someone is expected to pay back: the promised date, or when the expense is due. */
export function resolveReimbursementDueDate(input: {
  promisedDate: string | null;
  expenseDueDate: string | null;
  purchaseDate: string;
}) {
  return input.promisedDate ?? input.expenseDueDate ?? input.purchaseDate;
}

/**
 * The date follows the expense until it is late; only then can a new date be promised. Expenses
 * without a due date always need one.
 */
export function canChangeReimbursementDueDate(input: {
  expenseDueDate: string | null;
  today: string;
  isSettled: boolean;
}) {
  if (input.isSettled) return false;
  return input.expenseDueDate === null || input.expenseDueDate < input.today;
}

export type ReimbursementTarget = {
  sourceKey: string;
  personId: string;
  name: string;
  amount: number;
  purchaseDate: string;
  period: string;
  /** Month of the expense, where what is received reduces its category and budget. */
  expensePeriod: string;
  /** When the expense itself is due, or null without a due date. */
  expenseDueDate: string | null;
  dueDate: string;
  accountId: string | null;
  isGuaranteed: boolean;
};

export type ExistingReimbursement = {
  id: string;
  sourceKey: string;
  personId: string;
  name: string;
  /** What is left to receive. */
  amount: number;
  receivedAmount: number;
  purchaseDate: string;
  period: string;
  expensePeriod: string;
  expenseDueDate: string | null;
  dueDate: string | null;
  accountId: string | null;
  isGuaranteed: boolean;
  isSettled: boolean;
  isCustomized: boolean;
};

export type ReimbursementChange = Pick<
  ReimbursementTarget,
  | "name"
  | "amount"
  | "purchaseDate"
  | "period"
  | "expensePeriod"
  | "expenseDueDate"
  | "dueDate"
  | "accountId"
  | "isGuaranteed"
>;

/**
 * Compares what is owed with what is recorded. Anything already received is history: a settled
 * reimbursement is never rewritten, and one with payments is never removed.
 */
export function planReimbursementSync<Target extends ReimbursementTarget>(
  targets: readonly Target[],
  existing: readonly ExistingReimbursement[],
) {
  const key = (item: { sourceKey: string; personId: string }) =>
    `${item.sourceKey}:${item.personId}`;
  const existingByKey = new Map(existing.map((item) => [key(item), item]));
  const targetKeys = new Set(targets.map(key));
  const updates: Array<{ id: string; changes: ReimbursementChange }> = [];

  for (const target of targets) {
    const current = existingByKey.get(key(target));
    if (!current || current.isSettled) continue;
    const remainingCents = toCents(target.amount) - toCents(current.receivedAmount);
    const changes: ReimbursementChange = {
      name: target.name,
      amount: remainingCents > 0 ? fromCents(remainingCents) : current.amount,
      expensePeriod: target.expensePeriod,
      expenseDueDate: target.expenseDueDate,
      accountId: target.accountId,
      ...(current.isCustomized
        ? {
            purchaseDate: current.purchaseDate,
            period: current.period,
            dueDate: current.dueDate ?? target.dueDate,
            isGuaranteed: current.isGuaranteed,
          }
        : {
            purchaseDate: target.purchaseDate,
            period: target.period,
            dueDate: target.dueDate,
            isGuaranteed: target.isGuaranteed,
          }),
    };
    const changed = (Object.keys(changes) as Array<keyof ReimbursementChange>).some(
      (field) => changes[field] !== current[field],
    );
    if (changed) updates.push({ id: current.id, changes });
  }

  return {
    inserts: targets.filter((target) => !existingByKey.has(key(target))),
    updates,
    deletes: existing
      .filter(
        (item) =>
          !targetKeys.has(key(item)) && !item.isSettled && toCents(item.receivedAmount) === 0,
      )
      .map((item) => item.id),
  };
}

/**
 * Money expected from someone else only counts once received, unless the user trusts it
 * ("reembolso garantido").
 */
export function isCountedTransaction(input: {
  type: TransactionType;
  origin: string;
  personRole: "admin" | "external";
  isSettled: boolean;
  isGuaranteed: boolean;
}) {
  if (input.type !== "income" || input.personRole === "admin") return true;
  if (input.origin !== "regular" && input.origin !== "reimbursement") return true;
  return input.isSettled || input.isGuaranteed;
}

/**
 * Splits what was received above the amount due: first over the next pending reimbursements, in
 * order, when asked; the rest becomes income.
 */
export function allocateReimbursementSurplus(
  surplus: number,
  nextAmounts: readonly number[],
  destination: ReimbursementSurplusDestination,
) {
  let remaining = toCents(surplus);
  const allocations = (destination === "next" ? nextAmounts : []).map((amount) => {
    const cents = Math.min(remaining, toCents(amount));
    remaining -= cents;
    return fromCents(cents);
  });
  return {
    allocations: allocations.filter((amount) => amount > 0),
    incomeAmount: fromCents(remaining),
  };
}

export type PersonReceivableEntry = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personStatus: "active" | "inactive";
  amount: number;
  period: string;
  expectedDate: string;
  isSettled: boolean;
  settledDate: string | null;
  isPartial: boolean;
};

/** What each person owes, as of today, and what they paid back in the period. */
export function summarizeReceivablesByPerson(
  entries: readonly PersonReceivableEntry[],
  period: string,
  today: string,
) {
  const people = new Map<
    string,
    Pick<PersonReceivableEntry, "personId" | "personName" | "personAvatarUrl" | "personStatus"> & {
      pending: number;
      overdue: number;
      overdueCount: number;
      inPeriod: number;
      upcoming: number;
      partial: number;
      received: number;
    }
  >();
  for (const entry of entries) {
    const person = people.get(entry.personId) ?? {
      personId: entry.personId,
      personName: entry.personName,
      personAvatarUrl: entry.personAvatarUrl,
      personStatus: entry.personStatus,
      pending: 0,
      overdue: 0,
      overdueCount: 0,
      inPeriod: 0,
      upcoming: 0,
      partial: 0,
      received: 0,
    };
    people.set(entry.personId, person);
    const cents = Math.abs(toCents(entry.amount));
    if (entry.isSettled) {
      if ((entry.settledDate ?? entry.expectedDate).startsWith(period)) person.received += cents;
      if (entry.isPartial) person.partial += cents;
      continue;
    }
    person.pending += cents;
    if (entry.expectedDate < today) {
      person.overdue += cents;
      person.overdueCount += 1;
    } else if (entry.period <= period) person.inPeriod += cents;
    else person.upcoming += cents;
  }
  const items = [...people.values()]
    .map(({ pending, overdue, inPeriod, upcoming, partial, received, ...person }) => ({
      ...person,
      pendingAmount: fromCents(pending),
      overdueAmount: fromCents(overdue),
      dueAmount: fromCents(inPeriod),
      upcomingAmount: fromCents(upcoming),
      partialAmount: fromCents(partial),
      receivedAmount: fromCents(received),
    }))
    .filter((person) => person.pendingAmount > 0 || person.receivedAmount > 0)
    .sort(
      (left, right) =>
        right.overdueAmount - left.overdueAmount ||
        right.pendingAmount - left.pendingAmount ||
        left.personName.localeCompare(right.personName, "pt-BR"),
    );
  const total = (read: (item: (typeof items)[number]) => number) =>
    fromCents(items.reduce((sum, item) => sum + toCents(read(item)), 0));
  return {
    pendingAmount: total((item) => item.pendingAmount),
    overdueAmount: total((item) => item.overdueAmount),
    receivedAmount: total((item) => item.receivedAmount),
    items,
  };
}
