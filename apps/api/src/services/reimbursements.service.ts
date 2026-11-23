import {
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  calculateCardInvoiceSummary,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import {
  type DueDateAdjustmentDetails,
  type DueDateRulesReader,
  type DueDateRuleVersion,
  resolveDueDate,
} from "@openmonetis/domain/due-date-rules";
import { getRecurringDueDate } from "@openmonetis/domain/recurring-expenses";
import {
  calculateReimbursementShares,
  createReimbursementName,
  type ExistingReimbursement,
  type PersonReceivableEntry,
  planReimbursementSync,
  type ReimbursementTarget,
  reimbursementHorizonMonths,
  resolveReimbursementDueDate,
  summarizeReceivablesByPerson,
} from "@openmonetis/domain/reimbursements";
import { getOccurrenceAmount, type OccurrenceOverride } from "@openmonetis/domain/settlements";
import {
  addMonthsToPeriod,
  deriveTransactionPeriod,
  getPeriodFromDate,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { ReimbursementsSummaryOutput } from "@openmonetis/validators/reimbursements";

type ReimbursementPerson = { personId: string; role: "admin" | "external" };
type ReimbursementCard = {
  id: string;
  accountId: string;
  closingDay: number | null;
  closingRuleType: CardClosingRuleType;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
  closingDayPurchasesNextInvoice: boolean;
  dueDay: number;
};
type ReimbursementExpenseBase = {
  id: string;
  name: string;
  amount: string;
  dueDate: string | null;
  dueDateRuleExcluded: boolean;
  isGuaranteed: boolean;
  accountId: string | null;
  owner: ReimbursementPerson;
  splits: Array<ReimbursementPerson & { amount: string }>;
  card: ReimbursementCard | null;
};
export type ReimbursementExpenseRecord = ReimbursementExpenseBase & {
  purchaseDate: string;
  period: string;
  paymentMethod: PaymentMethod | null;
  frozenDueDate: string | null;
  promisedDate: string | null;
  refundedAmount: string;
};
export type ReimbursementRecurringExpenseRecord = ReimbursementExpenseBase & {
  seriesId: string;
  paymentMethod: PaymentMethod;
  anchorDate: string;
  startDate: string;
  endDate: string | null;
  recurrenceEndDate: string | null;
  frequency: RecurrenceFrequency;
  occurrenceOverrides: Record<string, OccurrenceOverride>;
};
export type ReimbursementInvoiceDateRecord = {
  cardId: string;
  period: string;
  closingDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  dueDateRuleExcluded: boolean;
  dueDateAdjustment: DueDateAdjustmentDetails | null;
  datesCustomized: boolean;
  paymentStatus: "pending" | "paid";
};
export type ReimbursementSyncTarget = ReimbursementTarget & {
  occurrence: { seriesId: string; date: string } | null;
};

export type ReimbursementsRepository = {
  listExpenses(userId: string): Promise<ReimbursementExpenseRecord[]>;
  listRecurringExpenses(userId: string): Promise<ReimbursementRecurringExpenseRecord[]>;
  listInvoiceDates(userId: string, cardIds: string[]): Promise<ReimbursementInvoiceDateRecord[]>;
  synchronize(
    userId: string,
    plan: (
      existing: ExistingReimbursement[],
    ) => ReturnType<typeof planReimbursementSync<ReimbursementSyncTarget>>,
  ): Promise<void>;
  listUserIds(): Promise<string[]>;
  listReceivables(userId: string, period: string): Promise<PersonReceivableEntry[]>;
};

export function createReimbursementsService(
  repository: ReimbursementsRepository,
  dueDateRules: DueDateRulesReader,
  today = getCurrentDateInBrazil,
) {
  /** Keeps every reimbursement in line with the expenses other people owe. */
  async function synchronize(userId: string) {
    const [expenses, recurringExpenses, versions] = await Promise.all([
      repository.listExpenses(userId),
      repository.listRecurringExpenses(userId),
      dueDateRules.listVersions(userId),
    ]);
    const cardIds = [
      ...new Set(
        [...expenses, ...recurringExpenses].flatMap((item) => (item.card ? [item.card.id] : [])),
      ),
    ];
    const resolveInvoiceDueDates = createInvoiceDueDatesResolver(
      await repository.listInvoiceDates(userId, cardIds),
      versions,
      today(),
    );
    const targets = [
      ...expenses.flatMap((expense) =>
        buildExpenseTargets(expense, versions, resolveInvoiceDueDates),
      ),
      ...recurringExpenses.flatMap((rule) =>
        buildRecurringTargets(rule, versions, resolveInvoiceDueDates, today()),
      ),
    ];
    await repository.synchronize(userId, (existing) => planReimbursementSync(targets, existing));
  }

  return {
    synchronize,
    async summarize(userId: string, period: string): Promise<ReimbursementsSummaryOutput> {
      const entries = await repository.listReceivables(userId, period);
      return { period, ...summarizeReceivablesByPerson(entries, period, today()) };
    },
    async synchronizeAll() {
      for (const userId of await repository.listUserIds())
        await synchronize(userId).catch((error) => {
          console.error("reimbursements_sync_failed", error);
        });
    },
  };
}

export type ReimbursementsService = ReturnType<typeof createReimbursementsService>;

type ExpenseDueDates = { original: string; due: string };
type InvoiceDueDatesResolver = (card: ReimbursementCard, period: string) => ExpenseDueDates;

function createInvoiceDueDatesResolver(
  invoiceDates: ReimbursementInvoiceDateRecord[],
  versions: DueDateRuleVersion[],
  today: string,
): InvoiceDueDatesResolver {
  const invoicesByKey = new Map(
    invoiceDates.map((invoice) => [`${invoice.cardId}:${invoice.period}`, invoice]),
  );
  return (card, period) => {
    const invoice = invoicesByKey.get(`${card.id}:${period}`);
    const summary = calculateCardInvoiceSummary({
      period,
      cardId: card.id,
      limit: 0,
      closingDay: card.closingDay,
      closingRule: resolveCardClosingRule(card),
      dueDay: card.dueDay,
      today,
      paymentStatus: invoice?.paymentStatus ?? "pending",
      movements: [],
      paidPeriods: [],
      persistedClosingDate: invoice?.closingDate,
      persistedDueDate: invoice?.dueDate,
      persistedOriginalDueDate: invoice?.originalDueDate,
      persistedDueDateAdjustment: invoice?.dueDateAdjustment,
      dueDateRuleExcluded: invoice?.dueDateRuleExcluded,
      datesCustomized: invoice?.datesCustomized ?? false,
      dueDateRuleVersions: versions,
    });
    return { original: summary.originalDueDate ?? summary.dueDate, due: summary.dueDate };
  };
}

function buildTargets(input: {
  sourceKey: string;
  occurrence: ReimbursementSyncTarget["occurrence"];
  expense: ReimbursementExpenseBase;
  amount: number | string;
  splits: Array<ReimbursementPerson & { amount: number | string }>;
  refundedAmount?: string;
  purchaseDate: string;
  expensePeriod: string;
  promisedDate: string | null;
  dueDates: ExpenseDueDates | null;
}): ReimbursementSyncTarget[] {
  const dueDate = resolveReimbursementDueDate({
    promisedDate: input.promisedDate,
    expenseDueDate: input.dueDates?.due ?? null,
    purchaseDate: input.purchaseDate,
  });
  // A due date moved by holidays stays in the month of the original one.
  const period = getPeriodFromDate(input.promisedDate ?? input.dueDates?.original ?? dueDate);
  return calculateReimbursementShares({
    amount: input.amount,
    owner: input.expense.owner,
    splits: input.splits,
    refundedAmount: input.refundedAmount,
  }).map((share) => ({
    sourceKey: input.sourceKey,
    occurrence: input.occurrence,
    personId: share.personId,
    name: createReimbursementName(input.expense.name),
    amount: share.amount,
    purchaseDate: dueDate,
    period,
    expensePeriod: input.expensePeriod,
    expenseDueDate: input.dueDates?.due ?? null,
    dueDate,
    accountId: input.expense.accountId ?? input.expense.card?.accountId ?? null,
    isGuaranteed: input.expense.isGuaranteed,
  }));
}

function buildExpenseTargets(
  expense: ReimbursementExpenseRecord,
  versions: DueDateRuleVersion[],
  resolveInvoiceDueDates: InvoiceDueDatesResolver,
) {
  return buildTargets({
    sourceKey: expense.id,
    occurrence: null,
    expense,
    amount: expense.amount,
    splits: expense.splits,
    refundedAmount: expense.refundedAmount,
    purchaseDate: expense.purchaseDate,
    expensePeriod: expense.period,
    promisedDate: expense.promisedDate,
    dueDates: expense.card
      ? resolveInvoiceDueDates(expense.card, expense.period)
      : resolveExpenseDueDates(
          {
            dueDate: expense.dueDate,
            excluded: expense.dueDateRuleExcluded,
            frozenDueDate: expense.frozenDueDate,
            paymentMethod: expense.paymentMethod,
            transactionId: expense.id,
          },
          versions,
        ),
  });
}

function buildRecurringTargets(
  rule: ReimbursementRecurringExpenseRecord,
  versions: DueDateRuleVersion[],
  resolveInvoiceDueDates: InvoiceDueDatesResolver,
  today: string,
) {
  const throughPeriod = addMonthsToPeriod(getPeriodFromDate(today), reimbursementHorizonMonths);
  const targets: ReimbursementSyncTarget[] = [];
  for (
    let period = getPeriodFromDate(rule.startDate);
    period <= throughPeriod;
    period = addMonthsToPeriod(period, 1)
  ) {
    for (const date of listRecurrenceDatesInPeriod({
      anchorDate: rule.anchorDate,
      startDate: rule.startDate,
      endDate: rule.endDate,
      recurrenceEndDate: rule.recurrenceEndDate,
      dueDate: rule.dueDate,
      frequency: rule.frequency,
      period,
    })) {
      const dueDate = getRecurringDueDate(rule.dueDate, date);
      const override = rule.occurrenceOverrides[date];
      const expensePeriod = deriveTransactionPeriod({
        paymentMethod: rule.paymentMethod,
        purchaseDate: date,
        dueDate,
        card: rule.card ? { ...rule.card, closingRule: resolveCardClosingRule(rule.card) } : null,
      });
      targets.push(
        ...buildTargets({
          sourceKey: `${rule.seriesId}:${date}`,
          occurrence: { seriesId: rule.seriesId, date },
          expense: rule,
          amount: getOccurrenceAmount(rule, date, rule.amount),
          splits: rule.splits.map((split) => ({
            ...split,
            amount: getOccurrenceAmount(rule, date, split.amount, split.personId),
          })),
          purchaseDate: date,
          expensePeriod,
          promisedDate: null,
          dueDates: rule.card
            ? resolveInvoiceDueDates(rule.card, expensePeriod)
            : resolveExpenseDueDates(
                {
                  dueDate,
                  excluded: override?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded,
                  frozenDueDate: override?.frozenDueDate,
                  paymentMethod: rule.paymentMethod,
                  seriesId: rule.seriesId,
                },
                versions,
              ),
        }),
      );
    }
  }
  return targets;
}

function resolveExpenseDueDates(
  input: {
    dueDate: string | null;
    excluded: boolean;
    frozenDueDate?: string | null;
    paymentMethod: PaymentMethod | null;
    transactionId?: string;
    seriesId?: string;
  },
  versions: DueDateRuleVersion[],
): ExpenseDueDates | null {
  if (!input.dueDate) return null;
  const resolution = resolveDueDate({ ...input, type: "expense", origin: "regular" }, versions);
  return { original: input.dueDate, due: resolution.dueDate ?? input.dueDate };
}
