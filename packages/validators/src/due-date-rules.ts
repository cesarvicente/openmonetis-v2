import { z } from "@hono/zod-openapi";
import { nationalHolidayIds } from "@openmonetis/domain/business-calendars";
import { dueDateAdjustments, dueDateRuleTargets } from "@openmonetis/domain/due-date-rules";
import { BusinessCalendarSchema } from "./business-calendars";

const ids = z
  .array(z.uuid())
  .max(100)
  .refine((values) => new Set(values).size === values.length);
export const DueDateRuleSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    target: z.enum(dueDateRuleTargets),
    scope: z.enum(["all", "selected"]),
    cardIds: ids,
    transactionIds: ids,
    seriesIds: ids,
    adjustment: z.enum(dueDateAdjustments),
    weekends: z.boolean(),
    holidays: z.boolean(),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.adjustment !== "none" && !rule.weekends && !rule.holidays)
      ctx.addIssue({ code: "custom", path: ["weekends"], message: "Select a trigger" });
    if (
      rule.target === "invoice"
        ? rule.transactionIds.length || rule.seriesIds.length
        : rule.cardIds.length
    )
      ctx.addIssue({ code: "custom", path: ["target"], message: "Invalid target selection" });
    const count = rule.cardIds.length + rule.transactionIds.length + rule.seriesIds.length;
    if ((rule.scope === "selected" && !count) || (rule.scope === "all" && count))
      ctx.addIssue({ code: "custom", path: ["scope"], message: "Invalid scope selection" });
  });
export const SaveDueDateRulesInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    effectiveFrom: z.iso.date().optional(),
    calendar: BusinessCalendarSchema.refine(
      (calendar) => calendar.workingWeekdays.join(",") === "1,2,3,4,5",
    ),
    rules: z
      .array(DueDateRuleSchema)
      .max(50)
      .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length),
  })
  .strict()
  .openapi("SaveDueDateRulesInput");
export const DueDateRulesOutputSchema = SaveDueDateRulesInputSchema.extend({
  effectiveFrom: z.iso.date(),
}).openapi("DueDateRulesOutput");
export const DueDateRuleHolidaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export const DueDateRuleHolidaysSchema = z.object({
  year: z.number().int(),
  items: z.array(z.object({ id: z.enum(nationalHolidayIds), date: z.iso.date() })),
});
export type DueDateRuleHolidays = z.infer<typeof DueDateRuleHolidaysSchema>;
export const DueDateRuleOptionsSchema = z.object({
  cards: z.array(z.object({ id: z.uuid(), name: z.string() })),
  payables: z.array(
    z.object({ id: z.uuid(), name: z.string(), kind: z.enum(["transaction", "series"]) }),
  ),
});
export const DueDateRulesPreviewSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      target: z.enum(dueDateRuleTargets),
      originalDueDate: z.iso.date(),
      currentDueDate: z.iso.date(),
      dueDate: z.iso.date(),
      ruleName: z.string().nullable(),
    }),
  ),
  from: z.iso.date(),
  through: z.iso.date(),
});
export type SaveDueDateRulesInput = z.infer<typeof SaveDueDateRulesInputSchema>;
export type DueDateRulesOutput = z.infer<typeof DueDateRulesOutputSchema>;
export type DueDateRuleOptions = z.infer<typeof DueDateRuleOptionsSchema>;
export type DueDateRulesPreview = z.infer<typeof DueDateRulesPreviewSchema>;

export const DueDateAdjustmentDetailsSchema = z.object({
  direction: z.enum(["next", "previous"]),
  ruleName: z.string().nullable(),
  reasons: z
    .array(
      z.object({
        date: z.iso.date(),
        weekend: z.enum(["saturday", "sunday"]).nullable(),
        nationalHolidayId: z.enum(nationalHolidayIds).nullable(),
        additionalHoliday: z.boolean(),
      }),
    )
    .max(371),
});
export const SetDueDateExceptionInputSchema = z.discriminatedUnion("target", [
  z
    .object({ target: z.literal("transaction"), transactionId: z.uuid(), excluded: z.boolean() })
    .strict(),
  z
    .object({
      target: z.literal("recurring"),
      recurringRuleId: z.uuid(),
      occurrenceDate: z.iso.date(),
      excluded: z.boolean(),
    })
    .strict(),
  z
    .object({
      target: z.literal("invoice"),
      cardId: z.uuid(),
      period: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
      excluded: z.boolean(),
    })
    .strict(),
]);
export type SetDueDateExceptionInput = z.infer<typeof SetDueDateExceptionInputSchema>;
export type DueDateAdjustmentDetails = z.infer<typeof DueDateAdjustmentDetailsSchema>;
