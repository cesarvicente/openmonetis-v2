import {
  cards,
  categories,
  db,
  financialAccounts,
  invoices,
  people,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionRefunds,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { reimbursementCategoryName } from "@openmonetis/domain/categories";
import type { PaymentMethod } from "@openmonetis/domain/transactions";
import { and, between, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ReimbursementsRepository } from "../services/reimbursements.service";
import { effectiveRecurringEndDateSql } from "./recurring-transactions.repository";
import {
  effectiveSplitAmountSql,
  effectiveTransactionAmountSql,
  partialPaymentsAmountSql,
  recurringOccurrenceOverridesSql,
} from "./settlements.repository";

const splitPeople = alias(people, "reimbursement_split_people");
const sourceExpenses = alias(transactions, "reimbursement_source_expenses");
const parentCategories = alias(categories, "reimbursement_parent_categories");
const expenseAccounts = alias(financialAccounts, "reimbursement_expense_accounts");
const expenseCardAccounts = alias(financialAccounts, "reimbursement_expense_card_accounts");

const cardColumns = {
  cardAccountId: cards.accountId,
  cardClosingDay: cards.closingDay,
  cardClosingRuleType: cards.closingRuleType,
  cardClosingOffsetDays: cards.closingOffsetDays,
  cardClosingOffsetMode: cards.closingOffsetMode,
  cardClosingDayPurchasesNextInvoice: cards.closingDayPurchasesNextInvoice,
  cardDueDay: cards.dueDay,
};

function toDateString(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toCard(row: {
  cardId: string | null;
  cardAccountId: string | null;
  cardClosingDay: number | null;
  cardClosingRuleType: (typeof cards.$inferSelect)["closingRuleType"] | null;
  cardClosingOffsetDays: number | null;
  cardClosingOffsetMode: (typeof cards.$inferSelect)["closingOffsetMode"];
  cardClosingDayPurchasesNextInvoice: boolean | null;
  cardDueDay: number | null;
}) {
  if (!row.cardId || !row.cardAccountId || !row.cardClosingRuleType || row.cardDueDay === null)
    return null;
  return {
    id: row.cardId,
    accountId: row.cardAccountId,
    closingDay: row.cardClosingDay,
    closingRuleType: row.cardClosingRuleType,
    closingOffsetDays: row.cardClosingOffsetDays,
    closingOffsetMode: row.cardClosingOffsetMode,
    closingDayPurchasesNextInvoice: row.cardClosingDayPurchasesNextInvoice ?? false,
    dueDay: row.cardDueDay,
  };
}

export const reimbursementsRepository = {
  async listExpenses(userId) {
    const rows = await db
      .select({
        id: transactions.id,
        name: transactions.name,
        amount: sql<string>`abs(${effectiveTransactionAmountSql} + ${partialPaymentsAmountSql})`.as(
          "amount",
        ),
        purchaseDate: transactions.purchaseDate,
        period: transactions.period,
        paymentMethod: transactions.paymentMethod,
        dueDate: transactions.dueDate,
        dueDateRuleExcluded: transactions.dueDateRuleExcluded,
        frozenDueDate: transactions.frozenDueDate,
        promisedDate: transactions.reimbursementDueDate,
        isGuaranteed: transactions.isGuaranteed,
        accountId: transactions.accountId,
        personId: transactions.personId,
        personRole: people.role,
        cardId: transactions.cardId,
        ...cardColumns,
        refundedAmount: sql<string>`coalesce((
          select sum(${transactionRefunds.amount}) from ${transactionRefunds}
          where ${transactionRefunds.sourceTransactionId} = ${transactions.id}
            and ${transactionRefunds.userId} = ${transactions.userId}
        ), 0)`.as("refunded_amount"),
      })
      .from(transactions)
      .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
      .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          eq(transactions.origin, "regular"),
          isNull(transactions.parentTransactionId),
          or(
            eq(people.role, "external"),
            exists(
              db
                .select({ id: transactionSplits.id })
                .from(transactionSplits)
                .innerJoin(
                  splitPeople,
                  and(
                    eq(transactionSplits.personId, splitPeople.id),
                    eq(splitPeople.userId, userId),
                    eq(splitPeople.role, "external"),
                  ),
                )
                .where(
                  and(
                    eq(transactionSplits.userId, userId),
                    eq(transactionSplits.transactionId, transactions.id),
                  ),
                ),
            ),
          ),
        ),
      );
    const ids = rows.map((row) => row.id);
    // A partially paid expense shares its split with its payments.
    const splitRows = ids.length
      ? await db
          .select({
            transactionId: sql<string>`coalesce(${transactions.parentTransactionId}, ${transactions.id})`,
            personId: transactionSplits.personId,
            role: people.role,
            amount: sql<string>`sum(${effectiveSplitAmountSql})`,
          })
          .from(transactionSplits)
          .innerJoin(
            transactions,
            and(
              eq(transactionSplits.transactionId, transactions.id),
              eq(transactions.userId, userId),
            ),
          )
          .innerJoin(
            people,
            and(eq(transactionSplits.personId, people.id), eq(people.userId, userId)),
          )
          .where(
            and(
              eq(transactionSplits.userId, userId),
              or(inArray(transactions.id, ids), inArray(transactions.parentTransactionId, ids)),
            ),
          )
          .groupBy(
            sql`coalesce(${transactions.parentTransactionId}, ${transactions.id})`,
            transactionSplits.personId,
            people.role,
          )
      : [];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      purchaseDate: toDateString(row.purchaseDate) as string,
      period: row.period,
      paymentMethod: row.paymentMethod,
      dueDate: toDateString(row.dueDate),
      dueDateRuleExcluded: row.dueDateRuleExcluded,
      frozenDueDate: toDateString(row.frozenDueDate),
      promisedDate: toDateString(row.promisedDate),
      isGuaranteed: row.isGuaranteed,
      accountId: row.accountId,
      owner: { personId: row.personId, role: row.personRole },
      card: toCard(row),
      refundedAmount: row.refundedAmount,
      splits: splitRows
        .filter((split) => split.transactionId === row.id)
        .map(({ personId, role, amount }) => ({ personId, role, amount })),
    }));
  },

  async listRecurringExpenses(userId) {
    const rows = await db
      .select({
        id: recurringTransactionRules.id,
        seriesId: recurringTransactionRules.seriesId,
        name: recurringTransactionRules.name,
        amount: recurringTransactionRules.amount,
        paymentMethod: recurringTransactionRules.paymentMethod,
        anchorDate: recurringTransactionRules.anchorDate,
        startDate: recurringTransactionRules.startDate,
        endDate: effectiveRecurringEndDateSql,
        recurrenceEndDate: recurringTransactionRules.recurrenceEndDate,
        frequency: recurringTransactionRules.frequency,
        dueDate: recurringTransactionRules.dueDate,
        dueDateRuleExcluded: recurringTransactionRules.dueDateRuleExcluded,
        isGuaranteed: recurringTransactionRules.isGuaranteed,
        accountId: recurringTransactionRules.accountId,
        personId: recurringTransactionRules.personId,
        personRole: people.role,
        cardId: recurringTransactionRules.cardId,
        ...cardColumns,
        occurrenceOverrides: recurringOccurrenceOverridesSql,
      })
      .from(recurringTransactionRules)
      .innerJoin(
        people,
        and(eq(recurringTransactionRules.personId, people.id), eq(people.userId, userId)),
      )
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          eq(recurringTransactionRules.type, "expense"),
          eq(recurringTransactionRules.status, "active"),
        ),
      );
    const splitRows = await db
      .select({
        ruleId: recurringTransactionSplits.recurringRuleId,
        personId: recurringTransactionSplits.personId,
        role: people.role,
        amount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionSplits)
      .innerJoin(
        people,
        and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, userId)),
      )
      .where(eq(recurringTransactionSplits.userId, userId));

    return rows
      .map((row) => ({
        id: row.id,
        seriesId: row.seriesId,
        name: row.name,
        amount: row.amount,
        paymentMethod: row.paymentMethod,
        anchorDate: toDateString(row.anchorDate) as string,
        startDate: toDateString(row.startDate) as string,
        endDate: toDateString(row.endDate),
        recurrenceEndDate: toDateString(row.recurrenceEndDate),
        frequency: row.frequency,
        dueDate: toDateString(row.dueDate),
        dueDateRuleExcluded: row.dueDateRuleExcluded,
        isGuaranteed: row.isGuaranteed,
        accountId: row.accountId,
        owner: { personId: row.personId, role: row.personRole },
        card: toCard(row),
        occurrenceOverrides: row.occurrenceOverrides,
        splits: splitRows
          .filter((split) => split.ruleId === row.id)
          .map(({ personId, role, amount }) => ({ personId, role, amount })),
      }))
      .filter((rule) =>
        (rule.splits.length ? rule.splits : [rule.owner]).some(
          (person) => person.role === "external",
        ),
      );
  },

  async listInvoiceDates(userId, cardIds) {
    if (!cardIds.length) return [];
    const rows = await db
      .select({
        cardId: invoices.cardId,
        period: invoices.period,
        closingDate: invoices.closingDate,
        dueDate: invoices.dueDate,
        originalDueDate: invoices.originalDueDate,
        dueDateRuleExcluded: invoices.dueDateRuleExcluded,
        dueDateAdjustment: invoices.dueDateAdjustment,
        datesCustomized: invoices.datesCustomized,
        paymentStatus: invoices.paymentStatus,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), inArray(invoices.cardId, cardIds)));
    return rows.map((row) => ({
      ...row,
      closingDate: toDateString(row.closingDate),
      dueDate: toDateString(row.dueDate),
      originalDueDate: toDateString(row.originalDueDate),
    }));
  },

  async synchronize(userId, plan) {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:reimbursements`}, 0))`,
      );
      const rows = await tx
        .select({
          id: transactions.id,
          sourceId: transactions.reimbursementSourceId,
          seriesId: transactions.reimbursementSeriesId,
          occurrenceDate: transactions.reimbursementOccurrenceDate,
          personId: transactions.personId,
          name: transactions.name,
          amount: transactions.amount,
          receivedAmount: partialPaymentsAmountSql,
          purchaseDate: transactions.purchaseDate,
          period: transactions.period,
          expensePeriod: transactions.reimbursementPeriod,
          expenseDueDate: transactions.reimbursementExpenseDueDate,
          dueDate: transactions.dueDate,
          accountId: transactions.accountId,
          isGuaranteed: transactions.isGuaranteed,
          isSettled: transactions.isSettled,
          isCustomized: transactions.reimbursementCustomized,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.origin, "reimbursement"),
            isNull(transactions.parentTransactionId),
          ),
        )
        .for("update");
      const changes = plan(
        rows.map((row) => ({
          id: row.id,
          sourceKey: row.sourceId ?? `${row.seriesId}:${toDateString(row.occurrenceDate)}`,
          personId: row.personId,
          name: row.name,
          amount: Number(row.amount),
          receivedAmount: Number(row.receivedAmount),
          purchaseDate: toDateString(row.purchaseDate) as string,
          period: row.period,
          expensePeriod: row.expensePeriod as string,
          expenseDueDate: toDateString(row.expenseDueDate),
          dueDate: toDateString(row.dueDate),
          accountId: row.accountId,
          isGuaranteed: row.isGuaranteed,
          isSettled: row.isSettled === true,
          isCustomized: row.isCustomized,
        })),
      );
      if (changes.deletes.length)
        await tx
          .delete(transactions)
          .where(and(eq(transactions.userId, userId), inArray(transactions.id, changes.deletes)));
      for (const { id, changes: values } of changes.updates)
        await tx
          .update(transactions)
          .set({
            name: values.name,
            amount: values.amount.toFixed(2),
            purchaseDate: toDate(values.purchaseDate),
            period: values.period,
            reimbursementPeriod: values.expensePeriod,
            reimbursementExpenseDueDate: values.expenseDueDate
              ? toDate(values.expenseDueDate)
              : null,
            dueDate: toDate(values.dueDate),
            accountId: values.accountId,
            isGuaranteed: values.isGuaranteed,
            updatedAt: new Date(),
          })
          .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
      if (!changes.inserts.length) return;
      const categoryId = await ensureReimbursementCategory(tx, userId);
      await tx.insert(transactions).values(
        changes.inserts.map((target) => ({
          userId,
          personId: target.personId,
          type: "income" as const,
          origin: "reimbursement" as const,
          condition: "single" as const,
          paymentMethod: "pix" as const,
          name: target.name,
          amount: target.amount.toFixed(2),
          purchaseDate: toDate(target.purchaseDate),
          period: target.period,
          reimbursementPeriod: target.expensePeriod,
          reimbursementExpenseDueDate: target.expenseDueDate ? toDate(target.expenseDueDate) : null,
          dueDate: toDate(target.dueDate),
          dueDateRuleExcluded: true,
          accountId: target.accountId,
          categoryId,
          isSettled: false,
          isGuaranteed: target.isGuaranteed,
          ...(target.occurrence
            ? {
                reimbursementSeriesId: target.occurrence.seriesId,
                reimbursementOccurrenceDate: toDate(target.occurrence.date),
              }
            : { reimbursementSourceId: target.sourceKey }),
        })),
      );
    });
  },

  async listReceivables(userId, period) {
    const parents = alias(transactions, "receivable_parents");
    const rows = await db
      .select({
        personId: people.id,
        personName: people.name,
        personAvatarUrl: people.avatarUrl,
        personStatus: people.status,
        amount: effectiveTransactionAmountSql.as("amount"),
        period: transactions.period,
        dueDate: transactions.dueDate,
        purchaseDate: transactions.purchaseDate,
        isSettled: transactions.isSettled,
        settledDate: transactions.settledDate,
        isPartial: sql<boolean>`coalesce(not ${parents.isSettled}, false)`.as("is_partial"),
      })
      .from(transactions)
      .innerJoin(
        people,
        and(
          eq(transactions.personId, people.id),
          eq(people.userId, userId),
          eq(people.role, "external"),
        ),
      )
      .leftJoin(
        parents,
        and(eq(transactions.parentTransactionId, parents.id), eq(parents.userId, userId)),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "income"),
          inArray(transactions.origin, ["regular", "reimbursement"]),
          isNull(transactions.cardId),
          or(
            eq(transactions.isSettled, false),
            eq(parents.isSettled, false),
            sql`to_char(coalesce(${transactions.settledDate}, ${transactions.purchaseDate}), 'YYYY-MM') = ${period}`,
          ),
        ),
      );
    return rows.map((row) => ({
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      personStatus: row.personStatus,
      amount: Number(row.amount),
      period: row.period,
      expectedDate: toDateString(row.dueDate ?? row.purchaseDate) as string,
      isSettled: row.isSettled === true,
      settledDate: toDateString(row.settledDate),
      isPartial: row.isPartial,
    }));
  },

  async listUserIds() {
    const rows = await db
      .selectDistinct({ userId: people.userId })
      .from(people)
      .where(eq(people.role, "external"));
    return rows.map((row) => row.userId);
  },
} satisfies ReimbursementsRepository;

/**
 * What other people paid back (or is guaranteed), as a reduction of the expense's category in the
 * month of the expense, whenever the money itself arrives.
 */
export async function listCategoryReimbursementsForUser(
  userId: string,
  startPeriod: string,
  endPeriod: string,
  options: { includePurchasePeriod?: boolean } = {},
) {
  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryParentId: categories.parentId,
      categoryParentName: parentCategories.name,
      categoryParentIcon: parentCategories.icon,
      amount: effectiveTransactionAmountSql.as("amount"),
      period: sql<string>`${transactions.reimbursementPeriod}`.as("period"),
      expensePurchaseDate:
        sql<string>`to_char(coalesce(${sourceExpenses.purchaseDate}, ${transactions.reimbursementOccurrenceDate}), 'YYYY-MM-DD')`.as(
          "expense_purchase_date",
        ),
      expensePaymentMethod:
        sql<PaymentMethod | null>`coalesce(${sourceExpenses.paymentMethod}, ${recurringTransactionRules.paymentMethod})`.as(
          "expense_payment_method",
        ),
      excludeFromBalance:
        sql<boolean>`coalesce(${expenseAccounts.excludeFromBalance}, ${expenseCardAccounts.excludeFromBalance}, false)`.as(
          "exclude_from_balance",
        ),
    })
    .from(transactions)
    .leftJoin(
      sourceExpenses,
      and(
        eq(transactions.reimbursementSourceId, sourceExpenses.id),
        eq(sourceExpenses.userId, userId),
      ),
    )
    .leftJoin(
      recurringTransactionRules,
      sql`${recurringTransactionRules.id} = (
        select r.id from recurring_transaction_rules r
        where r.user_id = ${userId}
          and r.series_id = ${transactions.reimbursementSeriesId}
          and r.start_date <= ${transactions.reimbursementOccurrenceDate}
        order by r.start_date desc limit 1
      )`,
    )
    .leftJoin(
      categories,
      and(
        sql`${categories.id} = coalesce(${sourceExpenses.categoryId}, ${recurringTransactionRules.categoryId})`,
        eq(categories.userId, userId),
      ),
    )
    .leftJoin(
      parentCategories,
      and(eq(categories.parentId, parentCategories.id), eq(parentCategories.userId, userId)),
    )
    .leftJoin(
      expenseAccounts,
      and(
        sql`${expenseAccounts.id} = coalesce(${sourceExpenses.accountId}, ${recurringTransactionRules.accountId})`,
        eq(expenseAccounts.userId, userId),
      ),
    )
    .leftJoin(
      cards,
      and(
        sql`${cards.id} = coalesce(${sourceExpenses.cardId}, ${recurringTransactionRules.cardId})`,
        eq(cards.userId, userId),
      ),
    )
    .leftJoin(
      expenseCardAccounts,
      and(eq(cards.accountId, expenseCardAccounts.id), eq(expenseCardAccounts.userId, userId)),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        or(eq(transactions.isSettled, true), eq(transactions.isGuaranteed, true)),
        or(
          between(transactions.reimbursementPeriod, startPeriod, endPeriod),
          options.includePurchasePeriod
            ? sql`to_char(${sourceExpenses.purchaseDate}, 'YYYY-MM') between ${startPeriod} and ${endPeriod}`
            : undefined,
        ),
      ),
    );
  return rows.map((row) => ({
    ...row,
    // Category analysis treats it like a refund: income that reduces the expense.
    origin: "refund" as const,
    type: "income" as const,
  }));
}

export async function ensureReimbursementCategory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
) {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.name, reimbursementCategoryName),
        eq(categories.type, "income"),
        isNull(categories.parentId),
      ),
    );
  if (existing) return existing.id;
  const [created] = await tx
    .insert(categories)
    .values({
      userId,
      name: reimbursementCategoryName,
      type: "income",
      icon: "refresh-cw",
      isSystem: true,
    })
    .returning({ id: categories.id });
  return (created as { id: string }).id;
}
