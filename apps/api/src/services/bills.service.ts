import {
  calculateOpenBillsTotal,
  getBillStatus,
  listRecurringBillOccurrences,
} from "@openmonetis/domain/bills";
import {
  type DueDateRulesReader,
  emptyDueDateRulesReader,
  resolveDueDate,
} from "@openmonetis/domain/due-date-rules";
import {
  getOccurrenceAmount,
  type SettlementAwareRule,
  SettlementError,
} from "@openmonetis/domain/settlements";
import {
  addMonthsToPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
  type TransactionCondition,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type {
  CreateBillPaymentInput,
  DashboardBill,
  DashboardBillsOutput,
} from "@openmonetis/validators/bills";
import { badRequest, notFound } from "../utils/errors";

type BillRelationRecord = {
  paymentMethod: PaymentMethod;
  accountId: string | null;
  accountName: string | null;
  accountLogo: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  splits: BillPersonRecord[];
  dueDateRuleExcluded?: boolean;
  frozenDueDate?: string | null;
  dueDateAdjustment?: import("@openmonetis/domain/due-date-rules").DueDateAdjustmentDetails | null;
};

type BillPersonRecord = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  amount: string;
};

type PersistedBillRecord = BillRelationRecord & {
  id: string;
  purchaseDate: string;
  name: string;
  amount: string;
  dueDate: string;
  boletoPaymentDate: string | null;
  settledDate: string | null;
  isSettled: boolean;
  condition: TransactionCondition;
  currentInstallment: number | null;
  installmentCount: number | null;
};

type RecurringBillRecord = BillRelationRecord &
  SettlementAwareRule & {
    id: string;
    seriesId: string;
    anchorDate: string;
    startDate: string;
    endDate?: string | null;
    dueDate: string | null;
    frequency: RecurrenceFrequency;
    name: string;
    amount: string;
    isSettled: boolean;
  };

type BillOccurrenceStateRecord = {
  dueDateRuleExcluded?: boolean | null;
  frozenDueDate?: string | null;
  dueDateAdjustment?: import("@openmonetis/domain/due-date-rules").DueDateAdjustmentDetails | null;
  recurringSeriesId: string;
  purchaseDate: string;
  isSettled: boolean;
  accountId: string | null;
  boletoPaymentDate: string | null;
  settledDate: string | null;
};

type BillAccountRecord = { id: string; name: string; logo: string | null };

export type BillsRepository = {
  listPersisted(userId: string, period: string): Promise<PersistedBillRecord[]>;
  listRecurring(userId: string, periodEnd: Date): Promise<RecurringBillRecord[]>;
  listOccurrenceStates(
    userId: string,
    seriesIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<BillOccurrenceStateRecord[]>;
  listAccounts(userId: string): Promise<BillAccountRecord[]>;
  payPersisted(
    userId: string,
    billId: string,
    accountId: string,
    paidAt: string,
    amount?: number,
  ): Promise<boolean>;
  payRecurring(
    userId: string,
    recurringRuleId: string,
    purchaseDate: string,
    accountId: string,
    paidAt: string,
    amount?: number,
  ): Promise<boolean>;
};

export function createBillsService(
  repository: BillsRepository,
  today = getCurrentDateInBrazil,
  dueDateRules: DueDateRulesReader = emptyDueDateRulesReader,
) {
  async function get(
    period: string,
    userId: string,
    byOriginalDueDate = false,
  ): Promise<DashboardBillsOutput> {
    const dueDateVersions = await dueDateRules.listVersions(userId);
    const [persisted, recurring, accounts] = await Promise.all([
      repository.listPersisted(userId, period),
      repository.listRecurring(
        userId,
        new Date(`${getPeriodEndDateString(addMonthsToPeriod(period, 13))}T23:59:59.999Z`),
      ),
      repository.listAccounts(userId),
    ]);
    const occurrenceStates = await repository.listOccurrenceStates(
      userId,
      [...new Set(recurring.map((rule) => rule.seriesId))],
      `${addMonthsToPeriod(period, -13)}-01`,
      getPeriodEndDateString(addMonthsToPeriod(period, 13)),
    );
    const states = new Map(
      occurrenceStates.map((state) => [`${state.recurringSeriesId}:${state.purchaseDate}`, state]),
    );
    const persistedItems: DashboardBill[] = persisted.map((bill) =>
      buildBill({
        ...bill,
        ...resolveDueDate(
          {
            dueDate: bill.dueDate,
            type: "expense",
            paymentMethod: bill.paymentMethod,
            transactionId: bill.id,
            excluded: bill.dueDateRuleExcluded,
            isSettled: bill.isSettled,
            frozenDueDate: bill.frozenDueDate,
            frozenAdjustment: bill.dueDateAdjustment,
          },
          dueDateVersions,
        ),
        recordId: bill.id,
        recurringRuleId: null,
        recurrenceFrequency: null,
        period,
        today: today(),
      }),
    );
    const recurringItems: DashboardBill[] = recurring.flatMap((rule) =>
      listRecurringBillOccurrences({
        ruleId: rule.id,
        anchorDate: rule.anchorDate,
        startDate: rule.startDate,
        endDate: rule.endDate,
        dueDate: rule.dueDate,

        configuredEndDate: rule.configuredEndDate,
        frequency: rule.frequency,
        period,
        includeAdjacent: true,
      }).map((occurrence) => {
        const state = states.get(`${rule.seriesId}:${occurrence.purchaseDate}`);
        const paymentAccount = state?.accountId
          ? accounts.find((account) => account.id === state.accountId)
          : null;
        return buildBill({
          ...rule,
          ...occurrence,
          recurringSeriesId: rule.seriesId,
          dueDateRuleExcluded: state?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded,
          ...resolveDueDate(
            {
              dueDate: occurrence.dueDate,
              type: "expense",
              paymentMethod: rule.paymentMethod,
              seriesId: rule.seriesId,
              excluded: state?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded,
              isSettled: state?.isSettled ?? rule.isSettled,
              frozenDueDate: state?.frozenDueDate,
              frozenAdjustment: state?.dueDateAdjustment,
            },
            dueDateVersions,
          ),
          amount: getOccurrenceAmount(rule, occurrence.purchaseDate, rule.amount).toFixed(2),
          splits: rule.splits.map((share) => ({
            ...share,
            amount: getOccurrenceAmount(
              rule,
              occurrence.purchaseDate,
              share.amount,
              share.personId,
            ).toFixed(2),
          })),
          recordId: null,
          recurringRuleId: rule.id,
          condition: "recurring",
          currentInstallment: null,
          installmentCount: null,
          recurrenceFrequency: rule.frequency,
          isSettled: state?.isSettled ?? rule.isSettled,
          boletoPaymentDate: state?.boletoPaymentDate ?? null,
          settledDate: state?.settledDate ?? state?.boletoPaymentDate ?? null,
          accountId: state?.accountId ?? rule.accountId,
          accountName: paymentAccount?.name ?? rule.accountName,
          accountLogo: paymentAccount?.logo ?? rule.accountLogo,
          period,
          today: today(),
        });
      }),
    );
    const items = [...persistedItems, ...recurringItems]
      .filter(
        (item) => (byOriginalDueDate ? item.originalDueDate : item.dueDate)?.slice(0, 7) === period,
      )
      .sort(compareBills);
    return {
      period,
      totalOpen: calculateOpenBillsTotal(items),
      overdueCount: items.filter((bill) => bill.status === "overdue").length,
      accounts,
      items,
    };
  }

  return {
    get,
    async pay(period: string, input: CreateBillPaymentInput, userId: string) {
      if (input.paidAt > today()) {
        throw badRequest("Payment date cannot be in the future", "bill_payment_date_future");
      }
      const snapshot = await get(period, userId);
      const bill = snapshot.items.find((item) => item.id === input.billId && !item.isSettled);
      if (!bill) throw notFound("Bill not found", "bill_not_found");
      if (!snapshot.accounts.some((account) => account.id === input.accountId)) {
        throw notFound("Account not found", "account_not_found");
      }
      let paid: boolean;
      try {
        paid = bill.recordId
          ? await repository.payPersisted(
              userId,
              bill.recordId,
              input.accountId,
              input.paidAt,
              input.amount,
            )
          : await repository.payRecurring(
              userId,
              bill.recurringRuleId as string,
              bill.purchaseDate,
              input.accountId,
              input.paidAt,
              input.amount,
            );
      } catch (error) {
        if (error instanceof SettlementError)
          throw badRequest("Invalid bill settlement", error.code);
        throw error;
      }
      return paid
        ? { id: bill.id, accountId: input.accountId, paidAt: input.paidAt }
        : Promise.reject(notFound("Bill not found", "bill_not_found"));
    },
  };
}

function buildBill(
  bill: BillRelationRecord & {
    id: string;
    recordId: string | null;
    recurringRuleId: string | null;
    purchaseDate: string;
    period: string;
    name: string;
    amount: string;
    dueDate: string | null;
    originalDueDate?: string | null;

    dueDateExceptionEditable?: boolean;
    recurringSeriesId?: string;
    boletoPaymentDate: string | null;
    settledDate: string | null;
    isSettled: boolean;
    condition: TransactionCondition;
    currentInstallment: number | null;
    installmentCount: number | null;
    recurrenceFrequency: RecurrenceFrequency | null;
    today: string;
  },
): DashboardBill {
  return {
    id: bill.id,
    recordId: bill.recordId,
    recurringRuleId: bill.recurringRuleId,
    purchaseDate: bill.purchaseDate,
    period: bill.period,
    name: bill.name,
    paymentMethod: bill.paymentMethod,
    amount: Math.abs(Number(bill.amount)),
    dueDate: bill.dueDate as string,
    originalDueDate: bill.originalDueDate ?? bill.dueDate,

    dueDateAdjustment: bill.dueDateAdjustment ?? null,
    dueDateExceptionEditable: bill.dueDateExceptionEditable ?? false,
    dueDateRuleExcluded: bill.dueDateRuleExcluded ?? false,
    recurringSeriesId: bill.recurringSeriesId ?? null,
    boletoPaymentDate: bill.boletoPaymentDate,
    settledDate: bill.settledDate ?? bill.boletoPaymentDate,
    isSettled: bill.isSettled,
    status: getBillStatus({ ...bill, dueDate: bill.dueDate as string }),
    condition: bill.condition,
    currentInstallment: bill.currentInstallment,
    installmentCount: bill.installmentCount,
    recurrenceFrequency: bill.recurrenceFrequency,
    accountId: bill.accountId,
    accountName: bill.accountName,
    accountLogo: bill.accountLogo,
    categoryName: bill.categoryName,
    categoryIcon: bill.categoryIcon,
    people: (bill.splits.length
      ? bill.splits
      : [
          {
            personId: bill.personId,
            personName: bill.personName,
            personAvatarUrl: bill.personAvatarUrl,
            amount: bill.amount,
          },
        ]
    )
      .map((person) => ({
        ...person,
        amount: Math.abs(Number(person.amount)),
      }))
      .sort((left, right) => left.personName.localeCompare(right.personName)),
  };
}

function compareBills(left: DashboardBill, right: DashboardBill) {
  if (left.isSettled !== right.isSettled) return left.isSettled ? 1 : -1;
  return left.dueDate.localeCompare(right.dueDate) || left.name.localeCompare(right.name);
}

export type BillsService = ReturnType<typeof createBillsService>;
