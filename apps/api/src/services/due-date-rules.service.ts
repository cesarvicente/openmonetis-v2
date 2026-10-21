import { listNationalHolidays } from "@openmonetis/domain/business-calendars";
import {
  assertDueDateExceptionEditable,
  type DueDateContext,
  type DueDateExceptionState,
  DueDateRuleError,
  type DueDateRulesReader,
  type DueDateRuleVersion,
  defaultDueDateRules,
  resolveDueDate,
  validateDueDateRuleConflicts,
} from "@openmonetis/domain/due-date-rules";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type {
  DueDateRuleOptions,
  DueDateRulesOutput,
  DueDateRulesPreview,
  SaveDueDateRulesInput,
  SetDueDateExceptionInput,
} from "@openmonetis/validators/due-date-rules";
import { badRequest, conflict, notFound } from "../utils/errors";
export type DueDateRulesRepository = DueDateRulesReader & {
  setException(
    userId: string,
    input: SetDueDateExceptionInput,
    assertEditable: (state: DueDateExceptionState) => void,
  ): Promise<boolean>;
  listTargets(userId: string): Promise<{
    cards: Array<{ id: string; name: string }>;
    transactions: Array<{ id: string; name: string }>;
    recurringSeries: Array<{ id: string; name: string }>;
  }>;
  appendVersion(userId: string, input: DueDateRulesOutput): Promise<DueDateRuleVersion | null>;
};
export type DueDatePreviewCandidate = DueDateContext & {
  id: string;
  name: string;
  target: "payable" | "invoice";
  currentDueDate: string;
};
export function createDueDateRulesService(
  repository: DueDateRulesRepository,
  candidates: (userId: string, from: string, through: string) => Promise<DueDatePreviewCandidate[]>,
  today = getCurrentDateInBrazil,
) {
  async function validate(input: DueDateRulesOutput, userId: string) {
    const [versions, options] = await Promise.all([
      repository.listVersions(userId),
      repository.listTargets(userId),
    ]);
    const latest = [...versions].sort((a, b) => b.revision - a.revision)[0];
    if (input.revision !== (latest?.revision ?? 0))
      throw conflict("Rules changed. Reload and try again", "DUE_DATE_RULES_STALE");
    if (input.effectiveFrom < today())
      throw badRequest("Invalid effective date", "DUE_DATE_RULES_EFFECTIVE_DATE");
    const cardIds = new Set(options.cards.map((item) => item.id));
    const transactionIds = new Set(options.transactions.map((item) => item.id));
    const seriesIds = new Set(options.recurringSeries.map((item) => item.id));
    if (
      input.rules.some(
        (rule) =>
          rule.cardIds.some((id) => !cardIds.has(id)) ||
          rule.transactionIds.some((id) => !transactionIds.has(id)) ||
          rule.seriesIds.some((id) => !seriesIds.has(id)),
      )
    )
      throw badRequest("Unavailable rule target", "DUE_DATE_RULE_TARGET_UNAVAILABLE");
    try {
      validateDueDateRuleConflicts(input.rules);
    } catch (error) {
      if (error instanceof DueDateRuleError)
        throw badRequest("Conflicting due date rules", error.code);
      throw error;
    }
    return versions;
  }
  return {
    async setException(input: SetDueDateExceptionInput, userId: string) {
      try {
        const changed = await repository.setException(
          userId,
          input,
          assertDueDateExceptionEditable,
        );
        if (!changed)
          throw notFound("Due date target not found", "DUE_DATE_RULE_TARGET_UNAVAILABLE");
        return { excluded: input.excluded };
      } catch (error) {
        if (error instanceof DueDateRuleError)
          throw conflict("Due date exception cannot be changed", error.code);
        throw error;
      }
    },
    holidays(year: number) {
      return { year, items: listNationalHolidays(year) };
    },
    async get(userId: string) {
      const versions = await repository.listVersions(userId);
      return (
        [...versions].sort((a, b) => b.revision - a.revision)[0] ?? defaultDueDateRules(today())
      );
    },
    async options(userId: string): Promise<DueDateRuleOptions> {
      const targets = await repository.listTargets(userId);
      return {
        cards: targets.cards.map(({ id, name }) => ({ id, name })),
        payables: [
          ...targets.transactions.map(({ id, name }) => ({
            id,
            name,
            kind: "transaction" as const,
          })),
          ...targets.recurringSeries.map(({ id, name }) => ({ id, name, kind: "series" as const })),
        ],
      };
    },
    async save(input: SaveDueDateRulesInput, userId: string) {
      const resolvedInput = { ...input, effectiveFrom: input.effectiveFrom ?? today() };
      await validate(resolvedInput, userId);
      const result = await repository.appendVersion(userId, resolvedInput);
      if (!result) throw conflict("Rules changed. Reload and try again", "DUE_DATE_RULES_STALE");
      return result;
    },
    async preview(input: SaveDueDateRulesInput, userId: string): Promise<DueDateRulesPreview> {
      const resolvedInput = { ...input, effectiveFrom: input.effectiveFrom ?? today() };
      const versions = await validate(resolvedInput, userId);
      const through = getPeriodEndDateString(
        addMonthsToPeriod(resolvedInput.effectiveFrom.slice(0, 7), 2),
      );
      const rows = await candidates(userId, resolvedInput.effectiveFrom, through);
      const draft = [...versions, { ...resolvedInput, revision: input.revision + 1 }];
      const items = rows
        .flatMap((row) => {
          const result = resolveDueDate(row, draft);
          if (
            !result.originalDueDate ||
            !result.dueDate ||
            result.originalDueDate < resolvedInput.effectiveFrom ||
            result.originalDueDate > through ||
            result.dueDate === row.currentDueDate
          )
            return [];
          return [
            {
              id: row.id,
              name: row.name,
              target: row.target,
              originalDueDate: result.originalDueDate,
              currentDueDate: row.currentDueDate,
              dueDate: result.dueDate,
              ruleName: result.dueDateAdjustment?.ruleName ?? null,
            },
          ];
        })
        .sort(
          (a, b) => a.originalDueDate.localeCompare(b.originalDueDate) || a.id.localeCompare(b.id),
        );
      return { items, from: resolvedInput.effectiveFrom, through };
    },
  };
}
export type DueDateRulesService = ReturnType<typeof createDueDateRulesService>;
