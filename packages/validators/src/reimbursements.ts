import { z } from "@hono/zod-openapi";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

export const ReimbursementsQuerySchema = z
  .object({
    period: periodSchema.openapi({ param: { name: "period", in: "query" }, example: "2026-11" }),
  })
  .openapi("ReimbursementsQuery");

export const PersonReceivableOutputSchema = z
  .object({
    personId: z.uuid(),
    personName: z.string(),
    personAvatarUrl: z.string().nullable(),
    personStatus: z.enum(["active", "inactive"]),
    pendingAmount: z.number().nonnegative().openapi({ description: "Everything still owed." }),
    overdueAmount: z.number().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    dueAmount: z.number().nonnegative().openapi({
      description: "Pending up to the period and not overdue yet.",
    }),
    upcomingAmount: z.number().nonnegative().openapi({ description: "Pending after the period." }),
    partialAmount: z.number().nonnegative().openapi({
      description: "Already received of what is still pending.",
    }),
    receivedAmount: z.number().nonnegative().openapi({ description: "Received in the period." }),
  })
  .openapi("PersonReceivable");

export const ReimbursementsSummaryOutputSchema = z
  .object({
    period: periodSchema,
    pendingAmount: z.number().nonnegative(),
    overdueAmount: z.number().nonnegative(),
    receivedAmount: z.number().nonnegative(),
    items: z.array(PersonReceivableOutputSchema),
  })
  .openapi("ReimbursementsSummary");

export type PersonReceivableOutput = z.infer<typeof PersonReceivableOutputSchema>;
export type ReimbursementsSummaryOutput = z.infer<typeof ReimbursementsSummaryOutputSchema>;
