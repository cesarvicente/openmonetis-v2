import { isPayable } from "@openmonetis/domain/bills";
import type { PaymentMethod } from "@openmonetis/domain/transactions";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type { BillsRepository } from "../services/bills.service";
import { settlePersistedTransactions } from "./settlements.repository";
import {
  listRecurringOccurrencesForUser,
  listRecurringRulesForPeriod,
  listRecurringSplitsForUser,
  listTransactionSplitsForUser,
  listTransactionsByDueDateRange,
  settleRecurringOccurrenceForUser,
} from "./transactions.repository";

function date(value: Date) {
  return value.toISOString().slice(0, 10);
}

export const billsRepository: BillsRepository = {
  async listPersisted(userId, period) {
    const rows = await listTransactionsByDueDateRange(
      userId,
      `${addMonthsToPeriod(period, -13)}-01`,
      getPeriodEndDateString(addMonthsToPeriod(period, 13)),
    );
    const billRows = rows.filter(
      (row): row is typeof row & { paymentMethod: PaymentMethod; dueDate: Date } =>
        isPayable({ ...row, dueDate: row.dueDate ? date(row.dueDate) : null }),
    );
    const splits = await listTransactionSplitsForUser(
      billRows.map((row) => row.id),
      userId,
    );
    return billRows.map((row) => ({
      id: row.id,
      purchaseDate: date(row.purchaseDate),
      name: row.name,
      paymentMethod: row.paymentMethod,
      amount: row.amount,
      dueDate: date(row.dueDate),
      dueDateRuleExcluded: row.dueDateRuleExcluded,
      frozenDueDate: row.frozenDueDate ? date(row.frozenDueDate) : null,
      dueDateAdjustment: row.dueDateAdjustment,
      boletoPaymentDate: row.boletoPaymentDate ? date(row.boletoPaymentDate) : null,
      settledDate: row.settledDate ? date(row.settledDate) : null,
      isSettled: row.isSettled ?? false,
      condition: row.condition,
      currentInstallment: row.currentInstallment,
      installmentCount: row.installmentCount,
      accountId: row.accountId,
      accountName: row.accountName,
      accountLogo: row.accountLogo,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      splits: splits.filter((split) => split.transactionId === row.id),
    }));
  },
  async listRecurring(userId, periodEnd) {
    const rows = await listRecurringRulesForPeriod(userId, periodEnd);
    const billRows = rows.filter((row) =>
      isPayable({ ...row, dueDate: row.dueDate ? date(row.dueDate) : null }),
    );
    const splits = await listRecurringSplitsForUser(
      billRows.map((row) => row.id),
      userId,
    );
    return billRows.map((row) => ({
      id: row.id,
      seriesId: row.seriesId,
      anchorDate: date(row.anchorDate),
      startDate: date(row.startDate),
      endDate: row.endDate ? date(row.endDate) : null,
      dueDate: row.dueDate ? date(row.dueDate) : null,
      dueDateRuleExcluded: row.dueDateRuleExcluded,

      configuredEndDate: row.configuredEndDate,
      occurrenceOverrides: row.occurrenceOverrides,
      frequency: row.frequency,
      name: row.name,
      paymentMethod: row.paymentMethod,
      amount: row.amount,
      isSettled: row.isSettled ?? false,
      accountId: row.accountId,
      accountName: row.accountName,
      accountLogo: row.accountLogo,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      splits: splits
        .filter((split) => split.recurringRuleId === row.id)
        .map(({ recurringRuleId: _recurringRuleId, ...split }) => split),
    }));
  },
  async listOccurrenceStates(userId, seriesIds, periodStart, periodEnd) {
    const rows = await listRecurringOccurrencesForUser(
      seriesIds,
      new Date(`${periodStart}T00:00:00.000Z`),
      new Date(`${periodEnd}T00:00:00.000Z`),
      userId,
    );
    return rows.map((row) => ({
      recurringSeriesId: row.recurringSeriesId,
      purchaseDate: date(row.purchaseDate),
      isSettled: row.isSettled,
      dueDateRuleExcluded: row.dueDateRuleExcluded,
      frozenDueDate: row.frozenDueDate ? date(row.frozenDueDate) : null,
      dueDateAdjustment: row.dueDateAdjustment,
      accountId: row.accountId,
      boletoPaymentDate: row.boletoPaymentDate ? date(row.boletoPaymentDate) : null,
      settledDate: row.settledDate ? date(row.settledDate) : null,
    }));
  },
  listAccounts(userId) {
    return db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        logo: financialAccounts.logo,
      })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isArchived, false)))
      .orderBy(asc(financialAccounts.name));
  },
  async payPersisted(userId, billId, accountId, paidAt, amount) {
    return Boolean(
      (
        await settlePersistedTransactions({
          ids: [billId],
          userId,
          isSettled: true,
          date: new Date(`${paidAt}T00:00:00.000Z`),
          amount,
          accountId,
        })
      ).length,
    );
  },
  async payRecurring(userId, recurringRuleId, purchaseDate, accountId, paidAt, amount) {
    return Boolean(
      await settleRecurringOccurrenceForUser(
        recurringRuleId,
        new Date(`${purchaseDate}T00:00:00.000Z`),
        userId,
        true,
        new Date(`${paidAt}T00:00:00.000Z`),
        accountId,
        amount,
      ),
    );
  },
};

import { db, financialAccounts } from "@openmonetis/db";
import { and, asc, eq } from "drizzle-orm";
