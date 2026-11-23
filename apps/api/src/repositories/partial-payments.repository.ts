import {
  db,
  financialAccounts,
  people,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionRuleTags,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
  transactionTags,
} from "@openmonetis/db";
import { createReimbursementSurplusName } from "@openmonetis/domain/reimbursements";
import { planPartialPayment, SettlementError } from "@openmonetis/domain/settlements";
import { getPeriodFromDate } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PartialPaymentRecordInput = {
  transactionId: string;
  userId: string;
  amount: number;
  date: string;
  accountId: string;
};

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Takes a payment out of a pending transaction: the payment becomes its own settled row and the
 * transaction keeps only what is left, so every total adds up without counting it twice.
 */
async function insertPartialPayment(tx: DatabaseTransaction, input: PartialPaymentRecordInput) {
  const [parent] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, input.userId)))
    .for("update");
  if (!parent) return null;
  if (
    parent.cardId ||
    parent.type === "transfer" ||
    (parent.origin !== "regular" && parent.origin !== "reimbursement")
  )
    throw new SettlementError("SETTLEMENT_UNSUPPORTED");
  if (parent.parentTransactionId) throw new SettlementError("PARTIAL_PAYMENT_LOCKED");
  if (parent.isSettled) throw new SettlementError("SETTLEMENT_ALREADY_CONFIRMED");
  await assertAccount(tx, input.accountId, input.userId);
  const splits = await tx
    .select({ personId: transactionSplits.personId, amount: transactionSplits.amount })
    .from(transactionSplits)
    .where(
      and(
        eq(transactionSplits.transactionId, parent.id),
        eq(transactionSplits.userId, input.userId),
      ),
    )
    .orderBy(asc(transactionSplits.id));
  const plan = planPartialPayment({
    remainingAmount: parent.amount,
    amount: input.amount,
    date: input.date,
    today: getCurrentDateInBrazil(),
    splits,
  });
  const [payment] = await tx
    .insert(transactions)
    .values({
      userId: input.userId,
      personId: parent.personId,
      type: parent.type,
      origin: parent.origin,
      condition: "single",
      paymentMethod: parent.paymentMethod,
      name: parent.name,
      amount: plan.paidAmount,
      settledAmount: plan.paidAmount,
      settledDate: toDate(input.date),
      boletoPaymentDate: parent.paymentMethod === "boleto" ? toDate(input.date) : null,
      purchaseDate: parent.purchaseDate,
      period: parent.period,
      accountId: input.accountId,
      categoryId: parent.categoryId,
      dueDate: parent.dueDate,
      dueDateRuleExcluded: true,
      isSettled: true,
      isGuaranteed: parent.isGuaranteed,
      reimbursementSourceId: parent.reimbursementSourceId,
      reimbursementSeriesId: parent.reimbursementSeriesId,
      reimbursementOccurrenceDate: parent.reimbursementOccurrenceDate,
      reimbursementPeriod: parent.reimbursementPeriod,
      reimbursementExpenseDueDate: parent.reimbursementExpenseDueDate,
      parentTransactionId: parent.id,
    })
    .returning({ id: transactions.id });
  const paymentId = (payment as { id: string }).id;
  for (const split of plan.splits) {
    await tx.insert(transactionSplits).values({
      userId: input.userId,
      transactionId: paymentId,
      personId: split.personId,
      amount: split.paidAmount,
      settledAmount: split.paidAmount,
    });
    await tx
      .update(transactionSplits)
      .set({ amount: split.remainingAmount })
      .where(
        and(
          eq(transactionSplits.transactionId, parent.id),
          eq(transactionSplits.personId, split.personId),
          eq(transactionSplits.userId, input.userId),
        ),
      );
  }
  const tags = await tx
    .select({ tagId: transactionTags.tagId })
    .from(transactionTags)
    .where(
      and(eq(transactionTags.transactionId, parent.id), eq(transactionTags.userId, input.userId)),
    );
  if (tags.length)
    await tx
      .insert(transactionTags)
      .values(tags.map(({ tagId }) => ({ userId: input.userId, transactionId: paymentId, tagId })));
  await tx
    .update(transactions)
    .set({ amount: plan.remainingAmount, updatedAt: new Date() })
    .where(and(eq(transactions.id, parent.id), eq(transactions.userId, input.userId)));
  return { id: paymentId };
}

async function assertAccount(tx: DatabaseTransaction, accountId: string, userId: string) {
  const [account] = await tx
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.isArchived, false),
      ),
    );
  if (!account) throw new SettlementError("SETTLEMENT_ACCOUNT_NOT_FOUND");
}

export function insertPartialPaymentForUser(input: PartialPaymentRecordInput) {
  return db.transaction((tx) => insertPartialPayment(tx, input));
}

export async function listPartialPaymentsForUser(transactionId: string, userId: string) {
  return db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      settledDate: transactions.settledDate,
      accountId: transactions.accountId,
      accountName: financialAccounts.name,
      accountLogo: financialAccounts.logo,
    })
    .from(transactions)
    .leftJoin(
      financialAccounts,
      and(eq(transactions.accountId, financialAccounts.id), eq(financialAccounts.userId, userId)),
    )
    .where(
      and(eq(transactions.userId, userId), eq(transactions.parentTransactionId, transactionId)),
    )
    .orderBy(asc(transactions.settledDate), asc(transactions.createdAt));
}

/** Gives a payment back to its transaction. */
export async function deletePartialPaymentForUser(
  transactionId: string,
  paymentId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({ id: transactions.id, isSettled: transactions.isSettled })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .for("update");
    if (!parent) return null;
    if (parent.isSettled) throw new SettlementError("PARTIAL_PAYMENT_REQUIRES_UNDO");
    const splits = await tx
      .select({ personId: transactionSplits.personId, amount: transactionSplits.amount })
      .from(transactionSplits)
      .where(
        and(eq(transactionSplits.transactionId, paymentId), eq(transactionSplits.userId, userId)),
      );
    const [payment] = await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, paymentId),
          eq(transactions.parentTransactionId, transactionId),
          eq(transactions.userId, userId),
        ),
      )
      .returning({ id: transactions.id, amount: transactions.amount });
    if (!payment) return null;
    await tx
      .update(transactions)
      .set({
        amount: sql`${transactions.amount} + ${payment.amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
    for (const split of splits)
      await tx
        .update(transactionSplits)
        .set({ amount: sql`${transactionSplits.amount} + ${split.amount}::numeric` })
        .where(
          and(
            eq(transactionSplits.transactionId, transactionId),
            eq(transactionSplits.personId, split.personId),
            eq(transactionSplits.userId, userId),
          ),
        );
    return { id: payment.id };
  });
}

/**
 * Turns an occurrence of a recurring transaction into a transaction of its own, so that it can be
 * paid in parts. The caller then skips the occurrence in the series.
 */
export async function materializeRecurringOccurrenceForUser(input: {
  recurringRuleId: string;
  purchaseDate: string;
  period: string;
  dueDate: string | null;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const [rule] = await tx
      .select()
      .from(recurringTransactionRules)
      .where(
        and(
          eq(recurringTransactionRules.id, input.recurringRuleId),
          eq(recurringTransactionRules.userId, input.userId),
        ),
      )
      .for("update");
    if (!rule || rule.cardId || rule.type === "transfer") return null;
    const [occurrence] = await tx
      .select({
        isSettled: recurringTransactionOccurrences.isSettled,
        dueDateRuleExcluded: recurringTransactionOccurrences.dueDateRuleExcluded,
      })
      .from(recurringTransactionOccurrences)
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, input.userId),
          eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
          eq(recurringTransactionOccurrences.purchaseDate, toDate(input.purchaseDate)),
        ),
      );
    if (occurrence?.isSettled) throw new SettlementError("SETTLEMENT_ALREADY_CONFIRMED");
    const [row] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        personId: rule.personId,
        type: rule.type,
        origin: "regular",
        condition: "single",
        paymentMethod: rule.paymentMethod,
        name: rule.name,
        amount: rule.amount,
        purchaseDate: toDate(input.purchaseDate),
        period: input.period,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        dueDate: input.dueDate ? toDate(input.dueDate) : null,
        dueDateRuleExcluded: occurrence?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded,
        autoSettleFrom: rule.autoSettleFrom,
        isSettled: false,
        isGuaranteed: rule.isGuaranteed,
        note: rule.note,
      })
      .returning({ id: transactions.id });
    const transactionId = (row as { id: string }).id;
    const splits = await tx
      .select({
        personId: recurringTransactionSplits.personId,
        amount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionSplits)
      .where(
        and(
          eq(recurringTransactionSplits.recurringRuleId, rule.id),
          eq(recurringTransactionSplits.userId, input.userId),
        ),
      );
    if (splits.length)
      await tx
        .insert(transactionSplits)
        .values(splits.map((split) => ({ ...split, transactionId, userId: input.userId })));
    const tags = await tx
      .select({ tagId: recurringTransactionRuleTags.tagId })
      .from(recurringTransactionRuleTags)
      .where(
        and(
          eq(recurringTransactionRuleTags.recurringRuleId, rule.id),
          eq(recurringTransactionRuleTags.userId, input.userId),
        ),
      );
    if (tags.length)
      await tx
        .insert(transactionTags)
        .values(tags.map(({ tagId }) => ({ tagId, transactionId, userId: input.userId })));
    // Its reimbursements now belong to the transaction.
    await tx
      .update(transactions)
      .set({
        reimbursementSourceId: transactionId,
        reimbursementSeriesId: null,
        reimbursementOccurrenceDate: null,
      })
      .where(
        and(
          eq(transactions.userId, input.userId),
          eq(transactions.reimbursementSeriesId, rule.seriesId),
          eq(transactions.reimbursementOccurrenceDate, toDate(input.purchaseDate)),
        ),
      );
    return { id: transactionId };
  });
}

/** Same-person reimbursements of the same purchase or recurrence, in the order they are due. */
export async function listSiblingReimbursementsForUser(transactionId: string, userId: string) {
  return db
    .select({
      id: transactions.id,
      personId: transactions.personId,
      amount: transactions.amount,
      period: transactions.period,
      dueDate: transactions.dueDate,
      isSettled: transactions.isSettled,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        isNull(transactions.parentTransactionId),
        sql`exists (
          select 1 from transactions current_item
          left join transactions current_expense
            on current_expense.id = current_item.reimbursement_source_id
            and current_expense.user_id = current_item.user_id
          left join transactions sibling_expense
            on sibling_expense.id = ${transactions.reimbursementSourceId}
            and sibling_expense.user_id = current_item.user_id
          where current_item.id = ${transactionId}
            and current_item.user_id = ${userId}
            and current_item.person_id = ${transactions.personId}
            and (
              current_item.reimbursement_series_id = ${transactions.reimbursementSeriesId}
              or current_expense.series_id = sibling_expense.series_id
            )
        )`,
      ),
    )
    .orderBy(asc(transactions.dueDate), asc(transactions.period), asc(transactions.id));
}

/**
 * Records what was received above a reimbursement: payments of the next ones and, for what is
 * left, an income of its own.
 */
export async function insertReimbursementSurplusForUser(input: {
  transactionId: string;
  userId: string;
  date: string;
  accountId: string;
  payments: Array<{ transactionId: string; amount: number; settles: boolean }>;
  incomeAmount: number;
}) {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, input.userId)));
    if (!source) return null;
    for (const payment of input.payments) {
      if (!payment.settles) {
        await insertPartialPayment(tx, {
          transactionId: payment.transactionId,
          userId: input.userId,
          amount: payment.amount,
          date: input.date,
          accountId: input.accountId,
        });
        continue;
      }
      await tx
        .update(transactions)
        .set({
          isSettled: true,
          settledAmount: payment.amount.toFixed(2),
          settledDate: toDate(input.date),
          accountId: input.accountId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(transactions.id, payment.transactionId), eq(transactions.userId, input.userId)),
        );
    }
    if (input.incomeAmount > 0) {
      const [admin] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.userId, input.userId), eq(people.role, "admin")));
      await tx.insert(transactions).values({
        userId: input.userId,
        personId: admin?.id ?? source.personId,
        type: "income",
        origin: "regular",
        condition: "single",
        paymentMethod: source.paymentMethod,
        name: createReimbursementSurplusName(source.name),
        amount: input.incomeAmount.toFixed(2),
        settledAmount: input.incomeAmount.toFixed(2),
        settledDate: toDate(input.date),
        purchaseDate: toDate(input.date),
        period: getPeriodFromDate(input.date),
        accountId: input.accountId,
        categoryId: source.categoryId,
        isSettled: true,
      });
    }
    return { id: source.id };
  });
}

/** Expenses among these that someone already paid back, in whole or in part. */
export async function hasReceivedReimbursementsForUser(
  userId: string,
  target:
    | { transactionIds: string[] }
    | { recurringSeriesId: string; fromDate: string; throughDate: string | null },
) {
  const sourceCondition =
    "transactionIds" in target
      ? inArray(transactions.reimbursementSourceId, target.transactionIds)
      : and(
          eq(transactions.reimbursementSeriesId, target.recurringSeriesId),
          sql`${transactions.reimbursementOccurrenceDate} >= ${target.fromDate}`,
          target.throughDate
            ? sql`${transactions.reimbursementOccurrenceDate} <= ${target.throughDate}`
            : undefined,
        );
  if ("transactionIds" in target && !target.transactionIds.length) return false;
  const [received] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        eq(transactions.isSettled, true),
        sourceCondition,
      ),
    )
    .limit(1);
  return Boolean(received);
}

/** Reimbursements linked to an expense, to its whole purchase, or to another reimbursement. */
export async function listLinkedReimbursementsForUser(transactionId: string, userId: string) {
  return db
    .select({
      id: transactions.id,
      personId: transactions.personId,
      personName: people.name,
      personAvatarUrl: people.avatarUrl,
      name: transactions.name,
      amount: sql<string>`case when ${transactions.isSettled} then coalesce(${transactions.settledAmount}, ${transactions.amount}) else ${transactions.amount} end`,
      partialAmount: sql<string>`coalesce((select sum(p.amount) from transactions p where p.parent_transaction_id = ${transactions.id} and p.user_id = ${transactions.userId}), 0)`,
      dueDate: transactions.dueDate,
      period: transactions.period,
      isSettled: transactions.isSettled,
      isGuaranteed: transactions.isGuaranteed,
      sourceId: transactions.reimbursementSourceId,
      occurrenceDate: transactions.reimbursementOccurrenceDate,
      currentInstallment: sql<
        number | null
      >`(select e.current_installment from transactions e where e.id = ${transactions.reimbursementSourceId} and e.user_id = ${transactions.userId})`,
      installmentCount: sql<
        number | null
      >`(select e.installment_count from transactions e where e.id = ${transactions.reimbursementSourceId} and e.user_id = ${transactions.userId})`,
    })
    .from(transactions)
    .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        isNull(transactions.parentTransactionId),
        sql`exists (
          select 1 from transactions target
          left join transactions target_expense
            on target_expense.id = coalesce(target.reimbursement_source_id, target.id)
            and target_expense.user_id = target.user_id
          left join transactions linked_expense
            on linked_expense.id = ${transactions.reimbursementSourceId}
            and linked_expense.user_id = target.user_id
          where target.id = ${transactionId}
            and target.user_id = ${userId}
            and (
              linked_expense.id = target_expense.id
              or linked_expense.series_id = target_expense.series_id
              or target.reimbursement_series_id = ${transactions.reimbursementSeriesId}
            )
        )`,
      ),
    )
    .orderBy(asc(transactions.dueDate), asc(people.name), asc(transactions.id));
}

export async function listRecurringLinkedReimbursementsForUser(
  recurringRuleId: string,
  userId: string,
) {
  return db
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(
      recurringTransactionRules,
      and(
        eq(recurringTransactionRules.seriesId, transactions.reimbursementSeriesId),
        eq(recurringTransactionRules.userId, userId),
        eq(recurringTransactionRules.id, recurringRuleId),
      ),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        isNull(transactions.parentTransactionId),
      ),
    )
    .orderBy(asc(transactions.dueDate))
    .limit(1);
}

/** Changes a reimbursement on its own, detaching those fields from the expense. */
export async function updateReimbursementForUser(
  id: string,
  userId: string,
  values: { isGuaranteed?: boolean; dueDate?: string },
) {
  const [row] = await db
    .update(transactions)
    .set({
      ...(values.isGuaranteed === undefined ? {} : { isGuaranteed: values.isGuaranteed }),
      ...(values.dueDate === undefined
        ? {}
        : {
            dueDate: toDate(values.dueDate),
            purchaseDate: toDate(values.dueDate),
            period: getPeriodFromDate(values.dueDate),
          }),
      reimbursementCustomized: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        eq(transactions.origin, "reimbursement"),
        isNull(transactions.parentTransactionId),
      ),
    )
    .returning({ id: transactions.id });
  return row ?? null;
}

/** Repeats on the pending reimbursements what was changed on their expense. */
export async function updateReimbursementsOfExpensesForUser(
  userId: string,
  target:
    | { dueDatesByTransaction: Array<{ transactionId: string; dueDate?: string | null }> }
    | { recurringSeriesId: string; fromDate: string | null; throughDate: string | null },
  values: { isGuaranteed?: boolean },
) {
  const pending = and(
    eq(transactions.userId, userId),
    eq(transactions.origin, "reimbursement"),
    eq(transactions.isSettled, false),
    isNull(transactions.parentTransactionId),
  );
  if ("recurringSeriesId" in target) {
    if (values.isGuaranteed === undefined) return;
    await db
      .update(transactions)
      .set({ isGuaranteed: values.isGuaranteed, updatedAt: new Date() })
      .where(
        and(
          pending,
          eq(transactions.reimbursementSeriesId, target.recurringSeriesId),
          target.fromDate
            ? sql`${transactions.reimbursementOccurrenceDate} >= ${target.fromDate}`
            : undefined,
          target.throughDate
            ? sql`${transactions.reimbursementOccurrenceDate} <= ${target.throughDate}`
            : undefined,
        ),
      );
    return;
  }
  for (const { transactionId, dueDate } of target.dueDatesByTransaction)
    await db
      .update(transactions)
      .set({
        ...(values.isGuaranteed === undefined ? {} : { isGuaranteed: values.isGuaranteed }),
        // Following the expense again: the next synchronization brings its date back.
        ...(dueDate === undefined ? {} : { reimbursementCustomized: false }),
        updatedAt: new Date(),
      })
      .where(and(pending, eq(transactions.reimbursementSourceId, transactionId)));
}

/** Whether a transaction, or any of these, has payments taken out of it. */
export async function hasPartialPaymentsForUser(transactionIds: string[], userId: string) {
  if (!transactionIds.length) return false;
  const [payment] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        or(inArray(transactions.parentTransactionId, transactionIds)),
      ),
    )
    .limit(1);
  return Boolean(payment);
}
