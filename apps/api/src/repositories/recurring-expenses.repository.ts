import {
  db,
  people,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSeries,
  recurringTransactionSplits,
} from "@openmonetis/db";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { RecurringExpensesRepository } from "../services/recurring-expenses.service";
import {
  effectiveRecurringEndDateSql,
  listRecurringRulesForReport,
  listRecurringSplitPeopleForReport,
  transitionRecurringRuleForUser,
} from "./recurring-transactions.repository";

import { readRecurringRuleTagIds, replaceRecurringRuleTags } from "./tags.repository";

export const recurringExpensesRepository = {
  async listForPeriod(userId, periodStart, periodEnd) {
    return listRecurringRulesForReport(userId, { type: "expense", periodStart, periodEnd });
  },

  async findForUser(id, userId) {
    const [rule] = await db
      .select({
        ...getTableColumns(recurringTransactionRules),
        endDate: effectiveRecurringEndDateSql,

        configuredEndDate: sql<
          string | null
        >`to_char(${recurringTransactionRules.recurrenceEndDate}, 'YYYY-MM-DD')`.as(
          "configured_end_date",
        ),
      })
      .from(recurringTransactionRules)
      .where(
        and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
      )
      .limit(1);
    if (!rule) return null;
    const [ownerRecord] = await db
      .select({ personRole: people.role })
      .from(people)
      .where(and(eq(people.id, rule.personId), eq(people.userId, userId)))
      .limit(1);
    const owner = ownerRecord as { personRole: "admin" | "external" };
    const splits = await db
      .select({
        personId: recurringTransactionSplits.personId,
        amount: recurringTransactionSplits.amount,
        personRole: people.role,
      })
      .from(recurringTransactionSplits)
      .innerJoin(
        people,
        and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionSplits.userId, userId),
          eq(recurringTransactionSplits.recurringRuleId, id),
        ),
      );
    return { ...rule, personRole: owner.personRole, splits };
  },

  async listOccurrenceStates(userId, seriesIds, startDate, endDate) {
    if (!seriesIds.length) return [];
    return db
      .select({
        recurringSeriesId: recurringTransactionOccurrences.recurringSeriesId,
        purchaseDate: recurringTransactionOccurrences.purchaseDate,
        isSettled: recurringTransactionOccurrences.isSettled,
      })
      .from(recurringTransactionOccurrences)
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, userId),
          inArray(recurringTransactionOccurrences.recurringSeriesId, seriesIds),
          sql`${recurringTransactionOccurrences.purchaseDate} between ${startDate} and ${endDate}`,
        ),
      );
  },

  listSplitPeople: listRecurringSplitPeopleForReport,

  async versionForUser(input) {
    if (["pause", "resume", "skip", "stop"].includes(input.mode)) {
      return transitionRecurringRuleForUser(
        input.id,
        input.userId,
        input.mode as "pause" | "resume" | "skip" | "stop",
        input.effectiveDate,
      );
    }
    return db.transaction(async (transaction) => {
      const [initial] = await transaction
        .select({ seriesId: recurringTransactionRules.seriesId })
        .from(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.id, input.id),
            eq(recurringTransactionRules.userId, input.userId),
          ),
        );
      if (!initial) return false;
      await transaction
        .select({ id: recurringTransactionSeries.id })
        .from(recurringTransactionSeries)
        .where(
          and(
            eq(recurringTransactionSeries.id, initial.seriesId),
            eq(recurringTransactionSeries.userId, input.userId),
          ),
        )
        .for("update");
      const [rule] = await transaction
        .select()
        .from(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.id, input.id),
            eq(recurringTransactionRules.userId, input.userId),
          ),
        )
        .limit(1)
        .for("update");
      if (!rule) return false;
      if (rule.status !== "active") return false;
      const splits = await transaction
        .select({
          personId: recurringTransactionSplits.personId,
          amount: recurringTransactionSplits.amount,
          personRole: people.role,
        })
        .from(recurringTransactionSplits)
        .innerJoin(
          people,
          and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, input.userId)),
        )
        .where(
          and(
            eq(recurringTransactionSplits.userId, input.userId),
            eq(recurringTransactionSplits.recurringRuleId, rule.id),
          ),
        );

      await transaction
        .update(recurringTransactionRules)
        .set({
          endDate: new Date(`${previousCalendarDate(input.effectiveDate)}T00:00:00.000Z`),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recurringTransactionRules.id, rule.id),
            eq(recurringTransactionRules.userId, input.userId),
          ),
        );

      const originalTagIds = await readRecurringRuleTagIds(transaction, rule.id, input.userId);
      const clone = async (
        startDate: string,
        endDate: string | null,
        changes?: {
          name: string;
          amount: string;
          splitShares?: Array<{ personId: string; amount: string }>;
        },
      ) => {
        const [createdRecord] = await transaction
          .insert(recurringTransactionRules)
          .values({
            userId: rule.userId,
            seriesId: rule.seriesId,
            personId: rule.personId,
            type: rule.type,
            paymentMethod: rule.paymentMethod,
            name: changes?.name ?? rule.name,
            amount: changes?.amount ?? rule.amount,
            anchorDate: rule.anchorDate,
            startDate: new Date(`${startDate}T00:00:00.000Z`),
            endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
            frequency: rule.frequency,
            recurrenceEndDate: rule.recurrenceEndDate,
            accountId: rule.accountId,
            cardId: rule.cardId,
            categoryId: rule.categoryId,
            sourceAccountId: rule.sourceAccountId,
            destinationAccountId: rule.destinationAccountId,
            dueDate: rule.dueDate,
            isSettled: rule.isSettled,
            note: rule.note,
            status: "active",
          })
          .returning({ id: recurringTransactionRules.id });
        const created = createdRecord as { id: string };
        await replaceRecurringRuleTags(transaction, created.id, input.userId, originalTagIds);
        const clonedSplits = changes?.splitShares ?? splits;
        if (clonedSplits.length) {
          await transaction.insert(recurringTransactionSplits).values(
            clonedSplits.map((split) => ({
              userId: input.userId,
              recurringRuleId: created.id,
              personId: split.personId,
              amount: split.amount,
            })),
          );
        }
        return created.id;
      };

      let effectiveVersionId: string | null = null;
      if (input.mode === "editFuture") {
        effectiveVersionId = await clone(
          input.effectiveDate,
          rule.endDate?.toISOString().slice(0, 10) ?? null,
          input.changes,
        );
      }
      if (input.mode === "editSingle") {
        effectiveVersionId = await clone(input.effectiveDate, input.effectiveDate, input.changes);
        if (input.nextDate) {
          await clone(input.nextDate, rule.endDate?.toISOString().slice(0, 10) ?? null);
        }
      }
      if (!effectiveVersionId) {
        await transaction
          .delete(recurringTransactionOccurrences)
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, input.userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
              eq(
                recurringTransactionOccurrences.purchaseDate,
                new Date(`${input.effectiveDate}T00:00:00.000Z`),
              ),
            ),
          );
      } else {
        await transaction
          .update(recurringTransactionOccurrences)
          .set({ recurringRuleId: effectiveVersionId, updatedAt: new Date() })
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, input.userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
              eq(
                recurringTransactionOccurrences.purchaseDate,
                new Date(`${input.effectiveDate}T00:00:00.000Z`),
              ),
            ),
          );
      }
      return true;
    });
  },
} satisfies RecurringExpensesRepository;

function previousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
