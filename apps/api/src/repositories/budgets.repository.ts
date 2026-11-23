import {
  budgets,
  cards,
  categories,
  db,
  recurringTransactionRules,
  transactions,
} from "@openmonetis/db";
import { resolveCardClosingRule } from "@openmonetis/domain/cards";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { BudgetsRepository } from "../services/budgets.service";
import { categoryLabelSql } from "./categories.repository";
import { effectiveRecurringEndDateSql } from "./recurring-transactions.repository";
import { listCategoryReimbursementsForUser } from "./reimbursements.repository";
import {
  effectiveTransactionAmountSql,
  recurringOccurrenceOverridesSql,
} from "./settlements.repository";

const budgetWithCategoryColumns = {
  id: budgets.id,
  userId: budgets.userId,
  categoryId: budgets.categoryId,
  period: budgets.period,
  amount: budgets.amount,
  createdAt: budgets.createdAt,
  updatedAt: budgets.updatedAt,
  categoryName: categoryLabelSql(categories),
  categoryIcon: categories.icon,
};

export const budgetsRepository = {
  async insertIfAbsent(data) {
    const [budget] = await db
      .insert(budgets)
      .values(data)
      .onConflictDoNothing({ target: [budgets.userId, budgets.categoryId, budgets.period] })
      .returning();
    return budget ?? null;
  },

  listByUserAndPeriod(userId, period) {
    return db
      .select(budgetWithCategoryColumns)
      .from(budgets)
      .innerJoin(
        categories,
        and(eq(budgets.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(and(eq(budgets.userId, userId), eq(budgets.period, period)))
      .orderBy(asc(categories.name));
  },

  async findByIdForUser(id, userId) {
    const [budget] = await db
      .select(budgetWithCategoryColumns)
      .from(budgets)
      .innerJoin(
        categories,
        and(eq(budgets.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .limit(1);
    return budget ?? null;
  },

  async findByCategoryAndPeriodForUser(categoryId, period, userId) {
    const [budget] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.categoryId, categoryId),
          eq(budgets.period, period),
          eq(budgets.userId, userId),
        ),
      )
      .limit(1);
    return budget ?? null;
  },

  async updateForUser(id, userId, data) {
    const [budget] = await db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return budget ?? null;
  },

  async deleteForUser(id, userId) {
    const [budget] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return budget ?? null;
  },

  async listSpendingEntries(userId, period) {
    const [entries, reimbursements] = await Promise.all([
      db
        .select({
          categoryId: transactions.categoryId,
          origin: transactions.origin,
          type: transactions.type,
          amount: effectiveTransactionAmountSql.as("amount"),
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.period, period))),
      listCategoryReimbursementsForUser(userId, period, period),
    ]);
    return [...entries, ...reimbursements];
  },

  async listRecurringRules(userId, periodEnd) {
    const rows = await db
      .select({
        categoryId: recurringTransactionRules.categoryId,
        type: recurringTransactionRules.type,
        amount: recurringTransactionRules.amount,
        anchorDate: recurringTransactionRules.anchorDate,
        startDate: recurringTransactionRules.startDate,
        endDate: effectiveRecurringEndDateSql,

        configuredEndDate: sql<
          string | null
        >`to_char(${recurringTransactionRules.recurrenceEndDate}, 'YYYY-MM-DD')`.as(
          "configured_end_date",
        ),
        occurrenceOverrides: recurringOccurrenceOverridesSql,
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        dueDate: recurringTransactionRules.dueDate,
        status: recurringTransactionRules.status,
        cardClosingDay: cards.closingDay,
        cardClosingRuleType: cards.closingRuleType,
        cardClosingOffsetDays: cards.closingOffsetDays,
        cardClosingOffsetMode: cards.closingOffsetMode,
        cardClosingDayPurchasesNextInvoice: cards.closingDayPurchasesNextInvoice,
        cardDueDay: cards.dueDay,
      })
      .from(recurringTransactionRules)
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          lte(recurringTransactionRules.startDate, new Date(periodEnd.getTime() + 32 * 86_400_000)),
        ),
      );

    return rows.map((row) => ({
      categoryId: row.categoryId,
      type: row.type,
      amount: row.amount,
      anchorDate: row.anchorDate.toISOString().slice(0, 10),
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      occurrenceOverrides: row.occurrenceOverrides,

      configuredEndDate: row.configuredEndDate,
      frequency: row.frequency,
      paymentMethod: row.paymentMethod,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      status: row.status,
      card:
        row.cardClosingRuleType !== null && row.cardDueDay !== null
          ? {
              closingDay: row.cardClosingDay,
              closingRule: resolveCardClosingRule({
                closingRuleType: row.cardClosingRuleType,
                closingDay: row.cardClosingDay,
                closingOffsetDays: row.cardClosingOffsetDays,
                closingOffsetMode: row.cardClosingOffsetMode,
                closingDayPurchasesNextInvoice: row.cardClosingDayPurchasesNextInvoice ?? false,
              }),
              dueDay: row.cardDueDay,
            }
          : null,
    }));
  },

  insertCopies(data) {
    return db
      .insert(budgets)
      .values(data)
      .onConflictDoNothing({ target: [budgets.userId, budgets.categoryId, budgets.period] })
      .returning();
  },
} satisfies BudgetsRepository;
