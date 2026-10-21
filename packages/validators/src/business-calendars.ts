import { z } from "@hono/zod-openapi";
export const BusinessCalendarSchema = z
  .object({
    workingWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length),
    includeNationalHolidays: z.boolean(),
    holidays: z
      .array(z.iso.date())
      .max(366)
      .refine((dates) => new Set(dates).size === dates.length),
  })
  .strict();
